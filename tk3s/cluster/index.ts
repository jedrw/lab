import { buildCluster } from "./cluster_setup/cluster_setup";
import { buildClusterServices } from "./cluster_services/cluster_services";

export = async () => {
  const cluster = await buildCluster();
  const clusterServices = await buildClusterServices(cluster);
};
