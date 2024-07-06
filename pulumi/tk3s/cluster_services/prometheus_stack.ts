import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import { k3sOpts } from "../kubernetes";

export const prometheus = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "prometheus";
  const prometheusRelease = new kubernetes.helm.v3.Release(
    releaseName,
    {
      name: releaseName,
      chart: "kube-prometheus-stack",
      namespace: releaseName,
      createNamespace: true,
      repositoryOpts: {
        repo: "https://prometheus-community.github.io/helm-charts",
      },
      values: {
        defaultRules: {
          rules: {
            windows: false,
          },
        },
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return prometheusRelease;
};
