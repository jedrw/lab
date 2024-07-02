import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

import { k3sOpts } from "../kubernetes";

export const kubeVipCloudController = async (dependsOn: pulumi.Resource) => {
  const releaseName = "kube-vip-cloud-controller";
  const releaseNamespace = "kube-system";

  const serviceAccount = new kubernetes.core.v1.ServiceAccount(
    `${releaseName}-service-account`,
    {
      metadata: {
        name: releaseName,
        namespace: releaseNamespace,
      },
    },
    k3sOpts,
  );

  const clusterRole = new kubernetes.rbac.v1.ClusterRole(
    `${releaseName}-cluster-role`,
    {
      metadata: {
        annotations: {
          "rbac.authorization.kubernetes.io/autoupdate": "true",
        },
        name: `system:${releaseName}-role`,
      },
      rules: [
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          verbs: ["get", "create", "update", "list", "put"],
        },
        {
          apiGroups: [""],
          resources: [
            "configmaps",
            "endpoints",
            "events",
            "services/status",
            "leases",
          ],
          verbs: ["*"],
        },
        {
          apiGroups: [""],
          resources: ["nodes", "services"],
          verbs: ["list", "get", "watch", "update"],
        },
      ],
    },
    k3sOpts,
  );

  const clusterRoleBinding = new kubernetes.rbac.v1.ClusterRoleBinding(
    `${releaseName}-cluster-role-binding`,
    {
      metadata: {
        name: `system:${releaseName}-binding`,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: clusterRole.metadata.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: serviceAccount.metadata.name,
          namespace: releaseNamespace,
        },
      ],
    },
    k3sOpts,
  );

  const secret = new kubernetes.core.v1.ConfigMap(
    `${releaseName}-secret`,
    {
      metadata: {
        name: "kubevip", // Apparently it must be called this :(
        namespace: releaseNamespace,
      },
      data: {
        "range-global": "192.168.203.2-192.168.203.254",
      },
    },
    k3sOpts,
  );

  const daemonset = new kubernetes.apps.v1.Deployment(
    `${releaseName}-deployment`,
    {
      metadata: {
        name: releaseName,
        namespace: releaseNamespace,
      },
      spec: {
        replicas: 1,
        revisionHistoryLimit: 10,
        selector: {
          matchLabels: {
            app: "kube-vip",
            component: releaseName,
          },
        },
        strategy: {
          rollingUpdate: {
            maxSurge: "25%",
            maxUnavailable: "25%",
          },
          type: "RollingUpdate",
        },
        template: {
          metadata: {
            labels: {
              app: "kube-vip",
              component: releaseName,
            },
          },
          spec: {
            containers: [
              {
                command: [
                  "/kube-vip-cloud-provider",
                  "--leader-elect-resource-name=kube-vip-cloud-controller",
                ],
                image: "ghcr.io/kube-vip/kube-vip-cloud-provider:v0.0.10",
                name: "kube-vip-cloud-provider",
                imagePullPolicy: "Always",
              },
            ],
            dnsPolicy: "ClusterFirst",
            restartPolicy: "Always",
            terminationGracePeriodSeconds: 30,
            serviceAccountName: releaseName,
            tolerations: [
              {
                key: "node-role.kubernetes.io/master",
                effect: "NoSchedule",
              },
              {
                key: "node-role.kubernetes.io/control-plane",
                effect: "NoSchedule",
              },
            ],
            affinity: {
              nodeAffinity: {
                preferredDuringSchedulingIgnoredDuringExecution: [
                  {
                    weight: 10,
                    preference: {
                      matchExpressions: [
                        {
                          key: "node-role.kubernetes.io/control-plane",
                          operator: "Exists",
                        },
                      ],
                    },
                  },
                  {
                    weight: 10,
                    preference: {
                      matchExpressions: [
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
      },
    },
    {
      ...k3sOpts,
      dependsOn: [clusterRoleBinding, secret, dependsOn],
    },
  );

  return daemonset;
};
