import * as pulumi from "@pulumi/pulumi";
import { kproximate } from "./kproximate";
import { kubeVipCloudController } from "./kube_vip_cloud_controller";
import { kubernetesPfsenseController } from "./kubernetes_pfsense_controller";
import { certManager } from "./cert_manager";
import { kubeVip } from "./kube_vip";

export async function clusterServices(): Promise<pulumi.Resource[]> {
  const kproximateRelease = await kproximate();
  const kubernetesPfsenseControllerRelease =
    await kubernetesPfsenseController(kproximateRelease);

  const kubeVipDaemonset = await kubeVip(kubernetesPfsenseControllerRelease);
  const kubeVipCloudControllerDeployment =
    await kubeVipCloudController(kubeVipDaemonset);

  const certManagerRelease = await certManager(kproximateRelease);

  return [
    kproximateRelease,
    kubernetesPfsenseControllerRelease,
    kubeVipDaemonset,
    kubeVipCloudControllerDeployment,
    certManagerRelease,
  ];
}
