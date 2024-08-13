import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import { merge } from "ts-deepmerge";

const DEFAULT_INGRESS_CLASS = "traefik";
const DEFAULT_ISSUER = "acme-clusterissuer";
const CLOUDFLARE_TARGET_RECORD = "lupinelab.co.uk";

type Expose = "internal" | "external";

export interface DeploymentArgs extends kubernetes.helm.v3.ReleaseArgs {
  hostname?: pulumi.Input<string>;
  expose?: Expose;
  disableTls?: boolean;
}

interface Values {
  [key: string]: any;
}

function setTlsValues(defaultValues: Values, hostname: pulumi.Input<string>) {
  defaultValues["ingress"]["annotations"]["cert-manager.io/cluster-issuer"] =
    DEFAULT_ISSUER;

  defaultValues["ingress"]["tls"] = [
    {
      hosts: [hostname],
      secretName: `${hostname}-cert`,
    },
  ];
}

function generateValues(
  values: pulumi.Input<Values>,
  hostname?: pulumi.Input<string>,
  expose?: Expose,
  disableTls?: boolean
) {
  if (expose && !hostname) {
    throw new Error("hostname is required for an exposed deployment");
  }

  const defaultValues: Values = {};
  switch (expose) {
    case "external":
      defaultValues["ingress"] = {
        className: DEFAULT_INGRESS_CLASS,
        annotations: {
          "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
          "external-dns.alpha.kubernetes.io/hostname": hostname,
          "external-dns.alpha.kubernetes.io/target": CLOUDFLARE_TARGET_RECORD,
          "external-dns.alpha.kubernetes.io/cloudflare-proxied": "true",
        },
        hosts: [
          {
            host: hostname,
            paths: [
              {
                path: "/",
                pathType: "ImplementationSpecific",
              },
            ],
          },
        ],
      };

      break;

    case "internal":
      defaultValues["ingress"] = {
        className: DEFAULT_INGRESS_CLASS,
        annotations: {
          "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
          "dns.pfsense.org/enabled": "true",
        },
        hosts: [
          {
            host: hostname,
            paths: [
              {
                path: "/",
                pathType: "ImplementationSpecific",
              },
            ],
          },
        ],
      };

      break;
  }

  if (expose && !disableTls) {
    setTlsValues(defaultValues, hostname!);
  }

  return merge(defaultValues, values);
}

export class Deployment extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: DeploymentArgs,
    opts: pulumi.ComponentResourceOptions
  ) {
    super("tk3s:index:Deployment", name, {}, opts);
    const { hostname, expose, disableTls, ...helmArgs } = args;

    helmArgs.values = generateValues(
      helmArgs.values ?? {},
      hostname,
      expose,
      disableTls
    );
    new kubernetes.helm.v3.Release(`${name}-release`, helmArgs, {
      ...opts,
      parent: this,
    });
  }
}
