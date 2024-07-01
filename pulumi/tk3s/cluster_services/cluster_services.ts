import * as kubernetes from "@pulumi/kubernetes";
import { certManager } from "./cert_manager";
import { kproximate } from "./kproximate";

export async function clusterServices(): Promise<kubernetes.helm.v3.Release[]> {
    return [
        await kproximate(),
        await certManager()
    ]
}