import * as pulumi from "@pulumi/pulumi";
import { kproximate } from "./kproximate";
import { proxmoxCsiPlugin } from "./proxmox_csi_plugin";
import { prometheus } from "./prometheus_stack";
import { loki } from "./loki_stack";
import { kubernetesPfsenseController } from "./kubernetes_pfsense_controller";
import { metalLb } from "./metallb";
import { externalDns } from "./external_dns";
import { certManager } from "./cert_manager";
import { circleciContainerAgent } from "./circleci_container_agent";
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

  const prometheusRelease = await prometheus([
    ...dependsOn,
    lokiRelease,
    kproximateRelease,
    proxmoxCsiPluginRelease,
    metalLbRelease,
  ]);

  const externalDnsRelease = await externalDns([
    ...dependsOn,
    kproximateRelease,
  ]);
  const certManagerRelease = await certManager([
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
  ];
}
