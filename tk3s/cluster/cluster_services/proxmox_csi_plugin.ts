import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";

import { proxmoxOpts } from "../proxmox";
import { k3sOpts } from "../kubernetes";
import { PROXOMX_CSI_STORAGECLASS } from "../constants";

export const proxmoxCsiPlugin = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "proxmox-csi";
  const role = new proxmox.permission.Role(
    `${releaseName}-role`,
    {
      privileges: [
        "VM.Audit",
        "VM.Config.Disk",
        "Datastore.Allocate",
        "Datastore.AllocateSpace",
        "Datastore.Audit",
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

  const proxmoxEndpoint = new pulumi.Config().require("proxmoxEndpoint");
  const release = new kubernetes.helm.v3.Release(
    releaseName,
    {
      chart: "oci://ghcr.io/sergelogvinov/charts/proxmox-csi-plugin",
      name: releaseName,
      createNamespace: true,
      namespace: releaseName,
      values: {
        config: {
          clusters: [
            {
              url: proxmoxEndpoint,
              insecure: true,
              token_id: pulumi.interpolate`${user.userId}!${token.tokenName}`,
              token_secret: token.value.apply((token) => token.split("=")[1]),
              region: "tc",
            },
          ],
        },
        storageClass: [
          {
            name: PROXOMX_CSI_STORAGECLASS,
            storage: "vms",
            reclaimPolicy: "Retain",
            allowVolumeExpansion: true,
            cache: "none",
            ssd: "true",
            volumeBindingMode: "WaitForFirstConsumer",
            parameters: {
              "csi.storage.k8s.io/fstype": "ext4",
            },
          },
        ],
        tolerations: [
          {
            key: "node-role.kubernetes.io/control-plane",
            effect: "NoSchedule",
          },
          {
            key: "node-role.kubernetes.io/master",
            effect: "NoSchedule",
          },
        ],
        node: {
          tolerations: [
            {
              key: "node-role.kubernetes.io/control-plane",
              effect: "NoSchedule",
            },
            {
              key: "node-role.kubernetes.io/master",
              effect: "NoSchedule",
            },
          ],
        },
        affinity: {
          nodeAffinity: {
            preferredDuringSchedulingIgnoredDuringExecution: [
              {
                weight: 1,
                preference: {
                  matchExpressions: [
                    {
                      key: "node-role.kubernetes.io/control-plane",
                      operator: "Exists",
                    },
                    {
                      key: "node-role.kubernetes.io/master",
                      operator: "Exists",
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return release;
};
