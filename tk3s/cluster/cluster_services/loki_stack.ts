import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import { k3sOpts } from "../kubernetes";

export const loki = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "loki";
  const lokiRelease = new kubernetes.helm.v3.Release(
    releaseName,
    {
      name: releaseName,
      chart: "loki-stack",
      namespace: releaseName,
      createNamespace: true,
      repositoryOpts: {
        repo: "https://grafana.github.io/helm-charts",
      },
      values: {
        loki: {
          image: {
            tag: "2.9.3",
          },
        },
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return lokiRelease;
};
