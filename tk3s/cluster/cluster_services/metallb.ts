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

  const addressPool = new kubernetes.apiextensions.CustomResource(
    "metallb-address-pool",
    {
      apiVersion: "metallb.io/v1beta1",
      kind: "IPAddressPool",
      metadata: {
        name: "default",
        namespace: metalLbRelease.namespace,
      },
      spec: {
        addresses: ["192.168.202.1/24"],
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
        myASN: 65002,
        peerASN: 65000,
        peerAddress: "192.168.200.1",
      },
    },
    {
      ...k3sOpts,
      dependsOn: metalLbRelease,
    },
  );

  new kubernetes.apiextensions.CustomResource(
    "metallb-bgp-advertisement",
    {
      apiVersion: "metallb.io/v1beta1",
      kind: "BGPAdvertisement",
      metadata: {
        name: "default",
        namespace: metalLbRelease.namespace,
      },
      spec: {
        ipAddressPools: [addressPool.metadata.name],
      },
    },
    {
      ...k3sOpts,
      dependsOn: metalLbRelease,
    },
  );

  new kubernetes.apiextensions.CustomResource(
    "api-server-ingress",
    {
      apiVersion: "traefik.io/v1alpha1",
      kind: "IngressRouteTCP",
      metadata: {
        name: "api-server-ingress",
        namespace: "default",
      },
      spec: {
        entryPoints: ["kubernetes"],
        routes: [
          {
            match: "HostSNI(`tk3s.lupinelab.co.uk`)",
            services: [
              {
                name: "kubernetes",
                port: 443,
              },
            ],
          },
        ],
        tls: {
          passthrough: true,
        },
      },
    },
    {
      ...k3sOpts,
      dependsOn: metalLbRelease,
    },
  );

  return metalLbRelease;
};
