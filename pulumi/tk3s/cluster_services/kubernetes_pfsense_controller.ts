import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import { k3sOpts } from "../kubernetes";

export const kubernetesPfsenseController = async (
  dependsOn: pulumi.Resource[],
) => {
  const secrets = await doppler.getSecrets({
    project: "kubernetes-pfsense-controller",
    config: "prod",
  });

  const releaseName = "pfsense-controller";
  const release = new kubernetes.helm.v3.Release(
    releaseName,
    {
      chart: "kubernetes-pfsense-controller",
      name: releaseName,
      createNamespace: true,
      namespace: releaseName,
      repositoryOpts: {
        repo: "https://travisghansen.github.io/kubernetes-pfsense-controller-chart/",
      },
      values: {
        pfsense: {
          url: "https://192.168.200.2",
          insecure: true,
          username: "admin",
          password: secrets.map["PFSENSE_PASSWORD"],
        },
        config: {
          "controller-id": "tk3s",
          enabled: true,
          plugins: {
            metallb: {
              enabled: true,
              "bgp-implementation": "frr",
              nodeLabelSelector: "node-role.kubernetes.io/control-plane=true",
              options: {
                frr: {
                  template: {
                    peergroup: "kube-vip",
                  },
                },
              },
            },
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
