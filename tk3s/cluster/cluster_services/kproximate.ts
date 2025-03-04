import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import * as random from "@pulumi/random";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";

import { proxmoxOpts } from "../proxmox";
import { k3sOpts } from "../kubernetes";

export const kproximate = async (dependsOn: pulumi.Resource[]) => {
  const secrets = await doppler.getSecrets({
    project: "lab",
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
    {
      ...proxmoxOpts,
      dependsOn,
    },
  );

  const user = new proxmox.permission.User(
    `${releaseName}-user`,
    {
      enabled: true,
      userId: `${releaseName}@pam`,
    },
    {
      ...proxmoxOpts,
      dependsOn,
    },
  );

  new proxmox.Acl(
    `${releaseName}-acl`,
    {
      userId: user.userId,
      roleId: role.roleId,
      path: "/",
      propagate: true,
    },
    {
      ...proxmoxOpts,
      dependsOn,
      deleteBeforeReplace: true,
    },
  );

  const token = new proxmox.user.Token(
    `${releaseName}-token`,
    {
      tokenName: releaseName,
      userId: user.userId,
      privilegesSeparation: false,
    },
    {
      ...proxmoxOpts,
      dependsOn,
    },
  );

  const rabbitPassword = new random.RandomPassword(
    `${releaseName}-rabbitmq-password`,
    {
      length: 16,
      special: false,
    },
    {
      dependsOn,
    },
  );

  const proxmoxEndpoint = new pulumi.Config().require("proxmoxEndpoint");

  // This relies on there being a compatible template named `kproximate-template`
  // present on the proxmox cluster.
  const release = new kubernetes.helm.v3.Release(
    releaseName,
    {
      chart: "oci://ghcr.io/jedrw/kproximate",
      version: "0.2.2",
      name: releaseName,
      createNamespace: true,
      namespace: releaseName,
      values: {
        kproximate: {
          config: {
            kpLoadHeadroom: 0.2,
            kpNodeCores: 4,
            kpNodeMemory: 4096,
            kpNodeLabels:
              "topology.kubernetes.io/region=tc,topology.kubernetes.io/zone={{ .TargetHost }}",
            kpNodeTemplateName: "kproximate-template",
            kpQemuExecJoin: true,
            maxKpNodes: 6,
            pmDebug: false,
            pmAllowInsecure: true,
            pmUrl: proxmoxEndpoint,
            pmUserID: pulumi.interpolate`${user.userId}!${token.tokenName}`,
          },
          secrets: {
            kpJoinCommand: `curl -sfL https://get.k3s.io | K3S_URL='https://k-c-01:6443' K3S_TOKEN='${secrets.map["K3S_TOKEN"]}' sh -`,
            pmToken: token.value.apply((token) => token.split("=")[1]),
            sshKey: secrets.map["SSH_USER_PUBLIC_KEY"],
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
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return release;
};
