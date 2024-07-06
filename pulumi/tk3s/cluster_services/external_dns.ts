import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import { k3sOpts } from "../kubernetes";

export const externalDns = async (dependsOn: pulumi.Resource[]) => {
  const secrets = await doppler.getSecrets({
    project: "external-dns",
    config: "prod",
  });

  const releaseName = "external-dns";
  const namespace = new kubernetes.core.v1.Namespace(
    `${releaseName}-namespace`,
    {
      metadata: {
        name: releaseName,
      },
    },
    k3sOpts,
  );

  const secret = new kubernetes.core.v1.Secret(
    `${releaseName}-cloudflare-secret`,
    {
      metadata: {
        name: `${releaseName}-cloudflare-api-token`,
        namespace: namespace.metadata.name,
      },
      stringData: {
        CLOUDFLARE_API_TOKEN: secrets.map["CLOUDFLARE_API_TOKEN"],
      },
    },
    k3sOpts,
  );

  const release = new kubernetes.helm.v3.Release(
    releaseName,
    {
      chart: "external-dns",
      name: releaseName,
      namespace: namespace.metadata.name,
      repositoryOpts: {
        repo: "https://kubernetes-sigs.github.io/external-dns",
      },
      values: {
        provider: {
          name: "cloudflare",
        },
        env: [
          {
            name: "CF_API_TOKEN",
            valueFrom: {
              secretKeyRef: {
                name: secret.metadata.name,
                key: "CLOUDFLARE_API_TOKEN",
              },
            },
          },
        ],
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return release;
};
