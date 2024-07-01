import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

export const k3sOpts: pulumi.ResourceOptions = {
  provider: new kubernetes.Provider("tk3s", {
    kubeconfig: process.env.KUBECONFIG,
    context: "tk3s",
  }),
};
