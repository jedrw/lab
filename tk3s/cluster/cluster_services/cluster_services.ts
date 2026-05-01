import * as pulumi from "@pulumi/pulumi";
import { certManager } from "./cert_manager";
import { chartmuseum } from "./chartmuseum";
import { circleciContainerAgent } from "./circleci_container_agent";
import { externalDns } from "./external_dns";
import { kproximate } from "./kproximate";
import { kubernetesPfsenseController } from "./kubernetes_pfsense_controller";
import { loki } from "./loki_stack";
import { metalLb } from "./metallb";
import { prometheus } from "./prometheus_stack";
import { proxmoxCsiPlugin } from "./proxmox_csi_plugin";
import { registry } from "./registry";

export async function buildClusterServices(
  dependsOn: pulumi.Resource[],
): Promise<pulumi.Resource[]> {
  const kproximateRelease = await kproximate([...dependsOn]);
  const kubernetesPfsenseControllerRelease = await kubernetesPfsenseController([
    ...dependsOn,
    kproximateRelease,
  ]);

  const metalLbRelease = await metalLb([
    ...dependsOn,
    kubernetesPfsenseControllerRelease,
  ]);

  const lokiRelease = await loki([...dependsOn, kproximateRelease]);

  const proxmoxCsiPluginRelease = await proxmoxCsiPlugin([
    ...dependsOn,
    kproximateRelease,
  ]);

  const certManagerRelease = await certManager([
    ...dependsOn,
    kproximateRelease,
  ]);

  const prometheusRelease = await prometheus([
    ...dependsOn,
    certManagerRelease,
    lokiRelease,
    kproximateRelease,
    kubernetesPfsenseControllerRelease,
    proxmoxCsiPluginRelease,
    metalLbRelease,
  ]);

  // const signoxRelease = await signoz([
  //   ...dependsOn,
  //   certManagerRelease,
  //   kproximateRelease,
  //   kubernetesPfsenseControllerRelease,
  //   proxmoxCsiPluginRelease,
  //   metalLbRelease,
  // ]);

  const externalDnsRelease = await externalDns([
    ...dependsOn,
    kproximateRelease,
  ]);

  const circleciContainerAgentRelease = await circleciContainerAgent([
    ...dependsOn,
    kproximateRelease,
  ]);

  const registryRelease = await registry([
    ...dependsOn,
    kproximateRelease,
    kubernetesPfsenseControllerRelease,
    externalDnsRelease,
    proxmoxCsiPluginRelease,
  ]);

  const chartmuseumRelease = await chartmuseum([
    ...dependsOn,
    kproximateRelease,
    kubernetesPfsenseControllerRelease,
    externalDnsRelease,
    proxmoxCsiPluginRelease,
  ]);

  return [
    lokiRelease,
    kproximateRelease,
    prometheusRelease,
    externalDnsRelease,
    certManagerRelease,
    kubernetesPfsenseControllerRelease,
    metalLbRelease,
    circleciContainerAgentRelease,
    registryRelease,
    chartmuseumRelease,
  ];
}
