import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export const k3sOpts: pulumi.CustomResourceOptions = {};

export function buildK3sOpts(kubeconfig: pulumi.Output<string>) {
  k3sOpts.provider = new kubernetes.Provider("tk3s", {
    kubeconfig: kubeconfig,
    context: "tk3s",
  });
}
