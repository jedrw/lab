import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";

import { k3sOpts } from "../kubernetes";

export const certManager = async () => {
  const secrets = await doppler.getSecrets({
    project: "cert-manager",
    config: "prod",
  });

  const releaseName = "cert-manager";
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
    "cloudflare-api-token",
    {
      metadata: {
        name: "cloudflare-api-token",
        namespace: namespace.metadata.name,
      },
      stringData: {
        ...secrets.map,
      },
    },
    k3sOpts,
  );

  const release = new kubernetes.helm.v3.Release(
    releaseName,
    {
      chart: "cert-manager",
      name: releaseName,
      namespace: namespace.metadata.name,
      repositoryOpts: {
        repo: "https://charts.jetstack.io",
      },
      values: {
        crds: {
          enabled: true,
        },
        // TODO remove these once kproximate is up and running
        // tolerations: [
        //     {
        //         key: "node-role.kubernetes.io/control-plane",
        //         operator: "Exists",
        //         effect: "NoSchedule",
        //     },
        // ],
        // webhook: {
        //     tolerations: [
        //         {
        //             key: "node-role.kubernetes.io/control-plane",
        //             operator: "Exists",
        //             effect: "NoSchedule",
        //         },
        //     ],
        // },
        // cainjector: {
        //     tolerations: [
        //         {
        //             key: "node-role.kubernetes.io/control-plane",
        //             operator: "Exists",
        //             effect: "NoSchedule",
        //         },
        //     ],
        // }
      },
    },
    k3sOpts,
  );

  new kubernetes.apiextensions.CustomResource(
    "cluster-issuer",
    {
      apiVersion: "cert-manager.io/v1",
      kind: "ClusterIssuer",
      metadata: {
        name: "acme-clusterissuer",
      },
      spec: {
        acme: {
          server: "https://acme-v02.api.letsencrypt.org/directory",
          solvers: [
            {
              dns01: {
                cloudflare: {
                  apiTokenSecretRef: {
                    key: "api-token",
                    name: secret.metadata.name,
                  },
                },
              },
            },
          ],
          email: "root@lupinelab.co.uk",
          preferredChain: "",
          privateKeySecretRef: {
            name: "acme-issuer-account-key",
          },
        },
      },
    },
    {
      ...k3sOpts,
      dependsOn: release,
    },
  );

  return release;
};
