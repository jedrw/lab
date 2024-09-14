import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import { k3sOpts } from "../kubernetes";

export const circleciContainerAgent = async (dependsOn: pulumi.Resource[]) => {
  const secrets = await doppler.getSecrets({
    project: "circleci-container-agent",
    config: "prod",
  });

  const releaseName = "container-agent";
  const release = new kubernetes.helm.v3.Release(
    "circleci-container-agent",
    {
      name: releaseName,
      chart: "container-agent",
      namespace: "circleci",
      createNamespace: true,
      repositoryOpts: {
        repo: "https://packagecloud.io/circleci/container-agent/helm",
      },
      values: {
        agent: {
          resourceClasses: {
            // TODO get Bill to make make new tk3s resource class.
            "billyrothman/tk3s": {
              token: secrets.map["MRROTHMANMATHS_QK3S_RESOURCE_CLASS_TOKEN"],
            },
            "lupinelab/tk3s": {
              token: secrets.map["LUPINELAB_TK3S_RESOURCE_CLASS_TOKEN"],
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
