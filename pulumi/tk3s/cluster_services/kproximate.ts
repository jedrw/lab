import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import * as random from "@pulumi/random";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";

import { proxmoxOpts } from "../proxmox";
import { k3sOpts } from "../kubernetes";

export const kproximate = async () => {
  const secrets = await doppler.getSecrets({
    project: "lupinecluster_infrastructure",
    config: "prod",
  });

  const releaseName = "kproximate";
  const role = new proxmox.permission.Role(
    `${releaseName}-role`,
    {
      privileges: [
        "Datastore.AllocateSpace",
        "Datastore.Audit",
        "SDN.Use",
        "Sys.Audit",
        "VM.Allocate",
        "VM.Audit",
        "VM.Clone",
        "VM.Config.Cloudinit",
        "VM.Config.CPU",
        "VM.Config.Disk",
        "VM.Config.Memory",
        "VM.Config.Network",
        "VM.Config.Options",
        "VM.Monitor",
        "VM.PowerMgmt",
      ],
      roleId: releaseName,
    },
    proxmoxOpts,
  );

  const user = new proxmox.permission.User(
    `${releaseName}-user`,
    {
      enabled: true,
      userId: `${releaseName}@pam`,
    },
    proxmoxOpts,
  );

  new proxmox.Acl(
    `${releaseName}-acl`,
    {
      userId: user.userId,
      roleId: role.roleId,
      path: "/",
      propagate: true,
    },
    proxmoxOpts,
  );

  const token = new proxmox.user.Token(
    `${releaseName}-token`,
    {
      tokenName: releaseName,
      userId: user.userId,
      privilegesSeparation: false,
    },
    proxmoxOpts,
  );

  const rabbitPassword = new random.RandomPassword(
    `${releaseName}-rabbitmq-password`,
    {
      length: 16,
      special: false,
    },
  );

  // This relies on there being a compatible template named `kproximate-template` being
  // present on the proxmox cluster.
  const release = new kubernetes.helm.v3.Release(
    releaseName,
    {
      chart: "kproximate",
      name: releaseName,
      createNamespace: true,
      namespace: releaseName,
      repositoryOpts: {
        repo: "https://charts.lupinelab.co.uk",
      },
      values: {
        kproximate: {
          config: {
            kpLoadHeadroom: 0.2,
            kpNodeCores: 2,
            kpNodeMemory: 2048,
            kpNodeTemplateName: "kproximate-template",
            kpQemuExecJoin: true,
            maxKpNodes: 3,
            pmDebug: false,
            pmAllowInsecure: true,
            pmUrl: "https://192.168.20.31:8006/api2/json",
            pmUserID: pulumi.interpolate`${user.userId}!${token.tokenName}`,
          },
          secrets: {
            kpJoinCommand: `curl -sfL https://get.k3s.io | K3S_URL='https://k-c-01:6443' K3S_TOKEN='${secrets.map["K3S_TOKEN"]}' sh -`,
            pmToken: token.value.apply((token) => token.split("=")[1]),
            sshKey:
              "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCmwrnNvwh6T8JcUJfAZT+12grJoP1o7JMIgDsudsI/nEKGrie6fTZ5+bhpfN9dNunnf5xALOfs4dExzGimsNZL7dEp+0pJuSM4NZ36z6JmWwJAojyhGG2E/5hK5oY1BrmZFxYk7komlLlyE7Ypdse/F5Chqw5a5X9aOYQqdlEeMN0YyDsujJ9cnKpYOmM8wdtXNFyg7uOrfWJQVfgVJCY0K5LsOV3uH6nRNIhKOmvbCMjXf99W3xib/ByHQXmWTIsOwtR5qCJDy6aOvoSKIxiBgRYcmfgylHyPV2YLlMKPT0hij5zyRR6jpOBKpoD3w5BAwBRyGpPoIdzZAXg1NkFLEIbYgk8kyBR8IMYvGp+AI58sQK4hSbVuESE5oWOzqLr6aikPjYjdPWUooq/N2G4yd16daM2+rpTO6H7YbjDVfeI4NI5WiVb3yQ8dVQwkhcMX5MVwKGWlypo+EdajEE8Bk1bmhLDpXfDdtg3XZvwa9flQFIpA92TtkVrZn74FpIs=",
          },
        },
        rabbitmq: {
          auth: {
            password: rabbitPassword.result,
          },
        },
        replicaCount: 3,
      },
    },
    k3sOpts,
  );

  return release;
};
