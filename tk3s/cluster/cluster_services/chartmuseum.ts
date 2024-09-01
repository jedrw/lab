import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import {
  CLOUDFLARE_TARGET_RECORD,
  DEFAULT_CLUSTERISSUER,
  DEFAULT_INGRESS_CLASS,
  DEFAULT_TRAEFIK_ENTRYPOINT,
  PROXMOX_CSI_STORAGECLASS,
} from "../constants";
import { k3sOpts } from "../kubernetes";

export const chartmuseum = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "chartmuseum";
  const secrets = await doppler.getSecrets({
    project: releaseName,
    config: "prod",
  });

  const hostname = "charts.lupinelab.co.uk";
  const chartmuseumRelease = new kubernetes.helm.v3.Release(
    releaseName,
    {
      name: releaseName,
      chart: releaseName,
      namespace: releaseName,
      createNamespace: true,
      repositoryOpts: {
        repo: "https://chartmuseum.github.io/charts",
      },
      values: {
        env: {
          open: {
            DISABLE_API: false,
            ALLOW_OVERWRITE: true,
            AUTH_ANONYMOUS_GET: true,
          }, 
          secret: {
            BASIC_AUTH_USER: secrets.map["CHARTMUSEUM_USERNAME"],
            BASIC_AUTH_PASS: secrets.map["CHARTMUSEUM_PASSWORD"],
          },
        },
        persistence: {
          enabled: true,
          storageClass: PROXMOX_CSI_STORAGECLASS,
          size: "8Gi",
        },
        ingress: {
          enabled: true,
          ingressClassName: DEFAULT_INGRESS_CLASS,
          hosts: [
            {
              name: hostname,
              tls: true,
              tlsSecret: `${hostname}-cert`,
            },
          ],
          annotations: {
            "traefik.ingress.kubernetes.io/router.entrypoints":
              DEFAULT_TRAEFIK_ENTRYPOINT,
            "external-dns.alpha.kubernetes.io/hostname": hostname,
            "external-dns.alpha.kubernetes.io/target": CLOUDFLARE_TARGET_RECORD,
            "external-dns.alpha.kubernetes.io/cloudflare-proxied": "true",
            "cert-manager.io/cluster-issuer": DEFAULT_CLUSTERISSUER,
          },
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
        tolerations: [
          {
            key: "node-role.kubernetes.io/control-plane",
            operator: "Exists",
            effect: "NoSchedule",
          },
          { key: "node-role.kubernetes.io/master",
            operator: "Exists",
            effect: "NoSchedule",
          },
        ] 
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return chartmuseumRelease;
};
