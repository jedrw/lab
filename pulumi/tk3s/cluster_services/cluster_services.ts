import * as pulumi from "@pulumi/pulumi";
import { kproximate } from "./kproximate";
import { kubernetesPfsenseController } from "./kubernetes_pfsense_controller";
import { kubeVip } from "./kube_vip";
import { kubeVipCloudProvider } from "./kube_vip_cloud_controller";
import { externalDns } from "./external_dns";
import { certManager } from "./cert_manager";

export async function clusterServices(): Promise<pulumi.Resource[]> {
  const kproximateRelease = await kproximate();
  const kubernetesPfsenseControllerRelease =
    await kubernetesPfsenseController(kproximateRelease);

  const kubeVipRelease = await kubeVip(kubernetesPfsenseControllerRelease);
  const kubeVipCloudProviderDeployment =
    await kubeVipCloudProvider(kubeVipRelease);

  const externalDnsRelease = await externalDns(kproximateRelease);
  const certManagerRelease = await certManager(kproximateRelease);

  return [
    kproximateRelease,
    kubernetesPfsenseControllerRelease,
    kubeVipRelease,
    kubeVipCloudProviderDeployment,
    externalDnsRelease,
    certManagerRelease,
  ];
}
