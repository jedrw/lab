import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";
import * as fs from "fs";
import { k3sOpts } from "../kubernetes";
import {
  DEFAULT_CLUSTERISSUER,
  DEFAULT_TRAEFIK_ENTRYPOINT,
  PROXMOX_CSI_STORAGECLASS,
} from "../constants";

export const prometheus = async (dependsOn: pulumi.Resource[]) => {
  const secrets = await doppler.getSecrets({
    project: "kube-prometheus-stack",
    config: "prod",
  });

  const releaseName = "prometheus";
  const grafanaHostname = "prometheus-grafana.lupinelab.co.uk";
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
