import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import { k3sOpts } from "../kubernetes";

export const metalLb = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "metallb";
  const releaseNamespace = "metallb-system";

  const metalLbRelease = new kubernetes.helm.v3.Release(
    `${releaseName}-release`,
    {
      name: releaseName,
      chart: "metallb",
      namespace: releaseNamespace,
      createNamespace: true,
      repositoryOpts: {
        repo: "https://metallb.github.io/metallb",
      },
      values: {
        speaker: {
          nodeSelector: {
            "node-role.kubernetes.io/control-plane": "true",
          },
        },
      },
    },
    {
      ...k3sOpts,
      dependsOn: dependsOn,
    },
  );

  new kubernetes.apiextensions.CustomResource(
    "metallb-address-pool",
    {
      apiVersion: "metallb.io/v1beta1",
      kind: "IPAddressPool",
      metadata: {
        name: "default",
        namespace: metalLbRelease.namespace,
      },
      spec: {
        addresses: ["192.168.203.0/24"],
      },
    },
    {
      ...k3sOpts,
      dependsOn: metalLbRelease,
    },
  );

  new kubernetes.apiextensions.CustomResource(
    "metallb-bgp-peer",
    {
      apiVersion: "metallb.io/v1beta1",
      kind: "BGPPeer",
      metadata: {
        name: "pfsense",
        namespace: metalLbRelease.namespace,
      },
      spec: {
        myASN: 65003,
        peerASN: 65000,
        peerAddress: "192.168.200.1",
      },
    },
    {
      ...k3sOpts,
      dependsOn: metalLbRelease,
    },
  );

  new kubernetes.networking.v1.Ingress(
    "api-server-ingress",
    {
      metadata: {
        name: "api-server-ingress",
        namespace: "default",
        annotations: {
          "dns.pfsense.org/enabled": "true",
        },
      },
      spec: {
        rules: [
          {
            host: "tk3s.lupinelab.co.uk",
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "ImplementationSpecific",
                  backend: {
                    service: {
                      name: "kubernetes",
                      port: {
                        name: "https",
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      ...k3sOpts,
      dependsOn: metalLbRelease,
    },
  );

  return metalLbRelease;
};
