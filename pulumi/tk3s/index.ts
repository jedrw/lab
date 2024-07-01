import { clusterServices } from "./cluster_services/cluster_services";
import * as pulumiNull from "@pulumi/null";

export = async () => {
    const services = await clusterServices()

    const depender = new pulumiNull.Resource(
        "cluster-services-depender",
        {},
        {
            dependsOn: services,
        }
    );
};
