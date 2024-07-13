import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";

const proxmoxEndpoint = new pulumi.Config().require("proxmoxEndpoint");

export const proxmoxOpts: pulumi.ResourceOptions = {
  provider: new proxmox.Provider("proxmox", {
    endpoint: proxmoxEndpoint,
    insecure: true,
    apiToken: `${process.env.PROXMOX_USERNAME}=${process.env.PROXMOX_TOKEN}`,
  }),
};
