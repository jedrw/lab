import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";

export const proxmoxOpts: pulumi.ResourceOptions = {
    provider: new proxmox.Provider(
        'proxmox',
        {
            endpoint: "https://192.168.20.31:8006/api2/json",
            insecure: true,
            apiToken: `${process.env.PROXMOX_USERNAME}=${process.env.PROXMOX_TOKEN}`,
        },
    )
};