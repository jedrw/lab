import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

import { k3sOpts } from "../kubernetes";

export const kubeVipCloudProvider = async (dependsOn: pulumi.Resource) => {
  const releaseName = "kube-vip-cloud-provider";
  const releaseNamespace = "kube-system";

  const configmap = new kubernetes.core.v1.ConfigMap(
    `${releaseName}-configmap`,
    {
      metadata: {
        name: "kubevip", // Apparently it must be called this :(
        namespace: releaseNamespace,
      },
      data: {
        "cidr-kube-system": "192.168.203.2/32",
        "range-global": "192.168.203.3-192.168.203.254",
      },
    },
    k3sOpts,
  );

  const release = new kubernetes.helm.v3.Release(
    `${releaseName}-release`,
    {
      name: releaseName,
      chart: "kube-vip-cloud-provider",
      namespace: releaseNamespace,
      repositoryOpts: {
        repo: "https://kube-vip.github.io/helm-charts",
      },
    },
    {
      ...k3sOpts,
      dependsOn: [configmap, dependsOn],
    },
  );

  return release;
};
