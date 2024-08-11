import { buildCluster } from "./cluster/cluster";
import { buildClusterServices } from "./cluster_services/cluster_services";

export = async () => {
  const cluster = await buildCluster();
  const clusterServices = await buildClusterServices(cluster);
};
