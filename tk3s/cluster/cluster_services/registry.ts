import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import {
  DEFAULT_CLUSTERISSUER,
  DEFAULT_INGRESS_CLASS,
  PROXMOX_CSI_STORAGECLASS,
} from "../constants";
import { externalIngressAnnotations } from "../../deployment/utils";
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
            ...externalIngressAnnotations(hostname),
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
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  return registryRelease;
};
