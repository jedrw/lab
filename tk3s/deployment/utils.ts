import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import * as os from "os";
import {
  CLOUDFLARE_TARGET_RECORD,
  DEFAULT_CLUSTERISSUER,
  DEFAULT_TRAEFIK_ENTRYPOINT,
} from "../cluster/constants";

export function getEnv(skipAbbreviation?: boolean) {
  const stack = pulumi.getStack();
  switch (stack) {
    case "production":
      return skipAbbreviation ? "production" : "prod";
    case "develop":
      return "dev";
    default:
      return stack;
  }
}

export function hostnamePrefix() {
  const env = getEnv();
  switch (env) {
    case "prod":
      return "";
    default:
      return `${env}-`;
  }
}

// Expects to find a kubeconfig file in ~/.kube/config as
// is normally produced by the install-kubeconfig job from
// the circleci/kubernetes orb.
export const k8sProvider = () => {
  return new kubernetes.Provider("tk3s", {
    kubeconfig: `${os.homedir()}/.kube/config`,
    context: "tk3s",
    deleteUnreachable: true,
  });
};

interface ExternalIngressArgs {
  hostname: pulumi.Input<string>;
  target?: pulumi.Input<string>;
  disableTls?: pulumi.Input<boolean>;
}

export function externalIngressAnnotations({
  hostname,
  target,
  disableTls,
}: ExternalIngressArgs) {
  return {
    "traefik.ingress.kubernetes.io/router.entrypoints":
      DEFAULT_TRAEFIK_ENTRYPOINT,
    "external-dns.alpha.kubernetes.io/hostname": hostname,
    "external-dns.alpha.kubernetes.io/target":
      target ?? CLOUDFLARE_TARGET_RECORD,
    "external-dns.alpha.kubernetes.io/cloudflare-proxied": "true",
    "cert-manager.io/cluster-issuer": disableTls
      ? undefined
      : DEFAULT_CLUSTERISSUER,
  };
}

export function internalIngressAnnotations() {
  return {
    "traefik.ingress.kubernetes.io/router.entrypoints":
      DEFAULT_TRAEFIK_ENTRYPOINT,
    "dns.pfsense.org/enabled": "true",
  };
}
