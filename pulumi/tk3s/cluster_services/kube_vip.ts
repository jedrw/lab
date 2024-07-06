import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import { k3sOpts } from "../kubernetes";

export const kubeVip = async (dependsOn: pulumi.Resource[]) => {
  const releaseName = "kube-vip";
  const releaseNamespace = "kube-system";

  // Once successfully deployed kubeconfig can be pointed at `values.config.address`
  const release = new kubernetes.helm.v3.Release(
    `${releaseName}-release`,
    {
      name: releaseName,
      chart: "kube-vip",
      namespace: releaseNamespace,
      repositoryOpts: {
        repo: "https://kube-vip.github.io/helm-charts",
      },
      values: {
        config: {
          address: "192.168.203.1",
        },
        env: {
          vip_arp: false,
          port: 6443,
          vip_interface: "ens18",
          vip_cidr: 32,
          dns_mode: "first",
          cp_enable: "true",
          cp_namespace: releaseNamespace,
          svc_enable: true,
          svc_leasename: "plndr-svcs-lock",
          bgp_enable: true,
          bgp_as: 65003,
          bgp_peeras: 65000,
          bgp_peers: "192.168.200.1:65000::false",
          prometheus_server: ":2112",
        },
        envValueFrom: {
          vip_nodename: {
            fieldRef: {
              apiVersion: "v1",
              fieldPath: "spec.nodeName",
            },
          },
          bgp_routerid: {
            fieldRef: {
              apiVersion: "v1",
              fieldPath: "status.podIP",
            },
          },
        },
        envFrom: {},
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
      },
    },
    {
      ...k3sOpts,
      dependsOn: dependsOn,
    },
  );

  return release;
};
