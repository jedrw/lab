import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as doppler from "@pulumiverse/doppler";
import * as fs from "fs";
import {
  DEFAULT_CLUSTERISSUER,
  DEFAULT_TRAEFIK_ENTRYPOINT,
  PROXMOX_CSI_STORAGECLASS,
} from "../constants";
import { k3sOpts } from "../kubernetes";

export const prometheus = async (dependsOn: pulumi.Resource[]) => {
  const secrets = await doppler.getSecrets({
    project: "kube-prometheus-stack",
    config: "prod",
  });

  const releaseName = "prometheus";
  const grafanaHostname = "prometheus-grafana.lupinelab.co.uk";
  const prometheusInternalHostname = "prometheus.lupinelab.co.uk";

  const namespace = new kubernetes.core.v1.Namespace(
    `${releaseName}-namespace`,
    {
      metadata: {
        name: releaseName,
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  const authSecret = new kubernetes.core.v1.Secret(
    `${releaseName}-auth-secret`,
    {
      metadata: {
        name: `${releaseName}-auth`,
        namespace: namespace.metadata.name,
      },
      type: "kubernetes.io/basic-auth",
      stringData: {
        username: secrets.map["PROMETHEUS_USERNAME"],
        password: secrets.map["PROMETHEUS_PASSWORD"],
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  const authMiddleware = new kubernetes.apiextensions.CustomResource(
    `${releaseName}-auth-middleware`,
    {
      apiVersion: "traefik.io/v1alpha1",
      kind: "Middleware",
      metadata: {
        name: `${releaseName}-auth`,
        namespace: namespace.metadata.name,
      },
      spec: {
        basicAuth: {
          removeHeader: true,
          secret: authSecret.metadata.name,
        },
      },
    },
    {
      ...k3sOpts,
      dependsOn,
    },
  );

  const prometheusRelease = new kubernetes.helm.v3.Release(
    releaseName,
    {
      name: releaseName,
      chart: "kube-prometheus-stack",
      namespace: namespace.metadata.name,
      createNamespace: false,
      repositoryOpts: {
        repo: "https://prometheus-community.github.io/helm-charts",
      },
      values: {
        defaultRules: {
          rules: {
            windows: false,
          },
        },
        prometheus: {
          prometheusSpec: {
            retention: "60d",
            storageSpec: {
              volumeClaimTemplate: {
                spec: {
                  storageClassName: PROXMOX_CSI_STORAGECLASS,
                  accessModes: ["ReadWriteOnce"],
                  resources: {
                    requests: {
                      storage: "100G",
                    },
                  },
                },
              },
            },
          },
          ingress: {
            enabled: true,
            annotations: {
              "traefik.ingress.kubernetes.io/router.entrypoints":
                DEFAULT_TRAEFIK_ENTRYPOINT,
              "dns.pfsense.org/enabled": "true",
              "cert-manager.io/cluster-issuer": DEFAULT_CLUSTERISSUER,
              "traefik.ingress.kubernetes.io/router.middlewares": pulumi.interpolate`${namespace.metadata.name}-${authMiddleware.metadata.name}@kubernetescrd`,
            },
            hosts: [prometheusInternalHostname],
            paths: ["/"],
            tls: [
              {
                hosts: [prometheusInternalHostname],
                secretName: `${prometheusInternalHostname}-cert`,
              },
            ],
          },
        },
        grafana: {
          adminPassword: secrets.map["GRAFANA_PASSWORD"],
          persistence: {
            enabled: true,
            type: "pvc",
            storageClassName: PROXMOX_CSI_STORAGECLASS,
            accessModes: ["ReadWriteOnce"],
            size: "20G",
          },
          additionalDataSources: [
            {
              name: "loki",
              access: "proxy",
              basicAuth: false,
              editable: false,
              type: "loki",
              url: "http://loki.loki.svc.cluster.local:3100",
            },
          ],
          ingress: {
            enabled: true,
            annotations: {
              "traefik.ingress.kubernetes.io/router.entrypoints":
                DEFAULT_TRAEFIK_ENTRYPOINT,
              "dns.pfsense.org/enabled": "true",
              "cert-manager.io/cluster-issuer": DEFAULT_CLUSTERISSUER,
            },
            hosts: [grafanaHostname],
            tls: [
              {
                secretName: `${grafanaHostname}-cert`,
                hosts: [grafanaHostname],
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

  new kubernetes.core.v1.ConfigMap(
    "loki-dashboard-configmap",
    {
      metadata: {
        name: "loki-dashboard",
        namespace: prometheusRelease.namespace,
        labels: {
          grafana_dashboard: "1",
        },
      },
      data: {
        "lokiDashboard.json": fs
          .readFileSync("cluster_services/grafana_dashboards/loki.json")
          .toString(),
      },
    },
    k3sOpts,
  );

  return prometheusRelease;
};
