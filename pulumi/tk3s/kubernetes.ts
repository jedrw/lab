import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export const k3sOpts: pulumi.ResourceOptions = {};

export function buildK3sOpts(kubeconfigString: pulumi.Output<string>) {
  k3sOpts.provider = new kubernetes.Provider(
    "tk3s",
    {
      kubeconfig: kubeconfigString,
      context: "tk3s",
    },
    { replaceOnChanges: ["kubeconfig"] },
  );
}
