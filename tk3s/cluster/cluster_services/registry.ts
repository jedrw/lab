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

export const registry = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "registry";
  const secrets = await doppler.getSecrets({
    project: releaseName,
    config: "prod",
  });

  const hostname = "docker.lupinelab.co.uk";
  const registryRelease = new kubernetes.helm.v3.Release(
    releaseName,
    {
      name: releaseName,
      chart: "docker-registry",
      namespace: releaseName,
      createNamespace: true,
      repositoryOpts: {
        repo: "https://helm.twun.io",
      },
      values: {
        ingress: {
          enabled: true,
          className: DEFAULT_INGRESS_CLASS,
          hosts: [hostname],
          annotations: {
            "traefik.ingress.kubernetes.io/router.entrypoints":
              DEFAULT_TRAEFIK_ENTRYPOINT,
            "external-dns.alpha.kubernetes.io/hostname": hostname,
            "external-dns.alpha.kubernetes.io/target": CLOUDFLARE_TARGET_RECORD,
            "external-dns.alpha.kubernetes.io/cloudflare-proxied": "true",
            "cert-manager.io/cluster-issuer": DEFAULT_CLUSTERISSUER,
          },
          tls: [
            {
              hosts: [hostname],
              secretName: `${hostname}-cert`,
            },
          ],
        },
        persistence: {
          enabled: true,
          size: "25Gi",
          storageClass: PROXMOX_CSI_STORAGECLASS,
        },
        secrets: {
          htpasswd: secrets.map["REGISTRY_HTPASSWD"],
        },
        tolerations: [
          {
            key: "node-role.kubernetes.io/control-plane",
            effect: "NoSchedule",
          },
          {
            key: "node-role.kubernetes.io/master",
            effect: "NoSchedule",
          },
        ],
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
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return registryRelease;
};
