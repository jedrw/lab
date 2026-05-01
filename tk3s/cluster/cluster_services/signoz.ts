import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import { k3sOpts } from "../kubernetes";
import {
  PROXMOX_CSI_STORAGECLASS,
  DEFAULT_INGRESS_CLASS,
  DEFAULT_TRAEFIK_ENTRYPOINT,
  DEFAULT_CLUSTERISSUER,
} from "../constants";

export const signoz = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "signoz";
  const signozHostname = "signoz.lupinelab.co.uk";
  const signozRelease = new kubernetes.helm.v3.Release(
    releaseName,
    {
      name: releaseName,
      chart: releaseName,
      repositoryOpts: {
        repo: "https://charts.signoz.io",
      },
      namespace: releaseName,
      createNamespace: true,
      values: {
        global: {
          clustername: "tk3s",
          storageClass: PROXMOX_CSI_STORAGECLASS,
        },
        clickhouse: {
          resources: {
            limits: {
              cpu: "3",
              memory: "3Gi",
            },
          },
        },
        signoz: {
          persistance: {
            size: "50Gi",
          },
          ingress: {
            enabled: true,
            className: DEFAULT_INGRESS_CLASS,
            annotations: {
              "traefik.ingress.kubernetes.io/router.entrypoints":
                DEFAULT_TRAEFIK_ENTRYPOINT,
              "dns.pfsense.org/enabled": "true",
              "cert-manager.io/cluster-issuer": DEFAULT_CLUSTERISSUER,
            },
            hosts: [
              {
                host: signozHostname,
                paths: [
                  { path: "/", pathType: "ImplementationSpecific", port: 8080 },
                ],
              },
            ],
            tls: [
              {
                secretName: `${signozHostname}-cert`,
                hosts: [signozHostname],
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

  return signozRelease;
};
