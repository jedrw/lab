import * as pulumi from "@pulumi/pulumi";
import { kproximate } from "./kproximate";
import { proxmoxCsiPlugin } from "./proxmox_csi_plugin";
import { prometheus } from "./prometheus_stack";
import { loki } from "./loki_stack";
import { kubernetesPfsenseController } from "./kubernetes_pfsense_controller";
import { kubeVip } from "./kube_vip";
import { kubeVipCloudProvider } from "./kube_vip_cloud_controller";
import { externalDns } from "./external_dns";
import { certManager } from "./cert_manager";

export async function buildClusterServices(
  dependsOn: pulumi.Resource[],
): Promise<pulumi.Resource[]> {
  const lokiRelease = await loki([...dependsOn]);
  const kproximateRelease = await kproximate([...dependsOn, lokiRelease]);
  const proxmoxCsiPluginRelease = await proxmoxCsiPlugin([
    ...dependsOn,
    kproximateRelease,
  ]);

  const prometheusRelease = await prometheus([
    ...dependsOn,
    lokiRelease,
    kproximateRelease,
    proxmoxCsiPluginRelease,
  ]);

  const externalDnsRelease = await externalDns([
    ...dependsOn,
    kproximateRelease,
  ]);
  const certManagerRelease = await certManager([
    ...dependsOn,
    kproximateRelease,
  ]);
  const kubernetesPfsenseControllerRelease = await kubernetesPfsenseController([
    ...dependsOn,
    kproximateRelease,
  ]);

  const kubeVipRelease = await kubeVip([
    ...dependsOn,
    kubernetesPfsenseControllerRelease,
  ]);
  const kubeVipCloudProviderRelease = await kubeVipCloudProvider([
    ...dependsOn,
    kubeVipRelease,
  ]);

  return [
    lokiRelease,
    kproximateRelease,
    prometheusRelease,
    externalDnsRelease,
    certManagerRelease,
    kubernetesPfsenseControllerRelease,
    kubeVipRelease,
    kubeVipCloudProviderRelease,
  ];
}
