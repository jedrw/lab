import { buildCluster } from "./cluster/cluster";
import { buildClusterServices } from "./cluster_services/cluster_services";
import * as pulumiNull from "@pulumi/null";

export = async () => {
  const cluster = await buildCluster();

  const clusterServices = await buildClusterServices(cluster);

  // const clusterServicesDepender = new pulumiNull.Resource(
  //   "cluster-services-depender",
  //   {},
  //   {
  //     dependsOn: clusterServices,
  //   },
  // );
};
