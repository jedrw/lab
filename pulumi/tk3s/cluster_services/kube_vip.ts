import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

import { k3sOpts } from "../kubernetes";

export const kubeVip = async (dependsOn: pulumi.Resource) => {
  const releaseName = "kube-vip";

  const serviceAccount = new kubernetes.core.v1.ServiceAccount(
    `${releaseName}-service-account`,
    {
      metadata: {
        name: releaseName,
        namespace: "kube-system",
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
          apiGroups: [""],
          resources: ["services/status"],
          verbs: ["update"],
        },
        {
          apiGroups: [""],
          resources: ["services", "endpoints"],
          verbs: ["list", "get", "watch", "update"],
        },
        {
          apiGroups: [""],
          resources: ["nodes"],
          verbs: ["list", "get", "watch", "update", "patch"],
        },
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          verbs: ["list", "get", "watch", "update", "create"],
        },
        {
          apiGroups: ["discovery.k8s.io"],
          resources: ["endpointslices`"],
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
          namespace: "kube-system",
        },
      ],
    },
    k3sOpts,
  );

  const daemonset = new kubernetes.apps.v1.DaemonSet(
    `${releaseName}-daemonset`,
    {
      metadata: {
        labels: {
          "app.kubernetes.io/name": releaseName,
          "app.kubernetes.io/version": "v0.8.1",
        },
        name: releaseName,
        namespace: "kube-system",
      },
      spec: {
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": releaseName,
          },
        },
        template: {
          metadata: {
            labels: {
              "app.kubernetes.io/name": releaseName,
              "app.kubernetes.io/version": "v0.8.1",
            },
          },
          spec: {
            affinity: {
              nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: {
                  nodeSelectorTerms: [
                    {
                      matchExpressions: [
                        {
                          key: "node-role.kubernetes.io/master",
                          operator: "Exists",
                        },
                      ],
                    },
                    {
                      matchExpressions: [
                        {
                          key: "node-role.kubernetes.io/control-plane",
                          operator: "Exists",
                        },
                      ],
                    },
                  ],
                },
              },
            },
            containers: [
              {
                args: ["manager"],
                env: [
                  {
                    name: "vip_arp",
                    value: "false",
                  },
                  {
                    name: "port",
                    value: "6443",
                  },
                  {
                    name: "vip_nodename",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "spec.nodeName",
                      },
                    },
                  },
                  {
                    name: "vip_interface",
                    value: "ens18",
                  },
                  {
                    name: "vip_cidr",
                    value: "32",
                  },
                  {
                    name: "dns_mode",
                    value: "first",
                  },
                  {
                    name: "cp_enable",
                    value: "true",
                  },
                  {
                    name: "cp_namespace",
                    value: "kube-system",
                  },
                  {
                    name: "svc_enable",
                    value: "true",
                  },
                  {
                    name: "svc_leasename",
                    value: "plndr-svcs-lock",
                  },
                  {
                    name: "bgp_enable",
                    value: "true",
                  },
                  {
                    name: "bgp_routerid",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "status.podIP",
                      },
                    },
                  },
                  {
                    name: "bgp_as",
                    value: "65003",
                  },
                  {
                    name: "bgp_peeraddress",
                  },
                  {
                    name: "bgp_peerpass",
                  },
                  {
                    name: "bgp_peeras",
                    value: "65000",
                  },
                  {
                    name: "bgp_peers",
                    value: "192.168.200.1:65000::false",
                  },
                  {
                    name: "address",
                    value: "192.168.203.1",
                  },
                  {
                    name: "prometheus_server",
                    value: ":2112",
                  },
                ],
                image: "ghcr.io/kube-vip/kube-vip:v0.8.1",
                imagePullPolicy: "IfNotPresent",
                name: releaseName,
                resources: {},
                securityContext: {
                  capabilities: {
                    add: ["NET_ADMIN", "NET_RAW"],
                  },
                },
              },
            ],
            hostNetwork: true,
            serviceAccountName: serviceAccount.metadata.name,
            tolerations: [
              {
                effect: "NoSchedule",
                operator: "Exists",
              },
              {
                effect: "NoExecute",
                operator: "Exists",
              },
            ],
          },
        },
        updateStrategy: {},
      },
    },
    {
      ...k3sOpts,
      dependsOn: [clusterRoleBinding, dependsOn],
    },
  );

  return daemonset;
};
