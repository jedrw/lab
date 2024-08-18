import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";
import { merge } from "ts-deepmerge";
import {
  DEFAULT_CLUSTERISSUER,
  DEFAULT_INGRESS_CLASS,
} from "../cluster/constants";
import {
  externalIngressAnnotations,
  internalIngressAnnotations,
} from "./utils";

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
    DEFAULT_CLUSTERISSUER;

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
  const defaultValues: Values = {};
  switch (expose) {
    case "external":
      if (!hostname) {
        throw new Error("hostname is required for an exposed deployment");
      }

      defaultValues["ingress"] = {
        className: DEFAULT_INGRESS_CLASS,
        annotations: externalIngressAnnotations(hostname),
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
      if (!hostname) {
        throw new Error("hostname is required for an exposed deployment");
      }

      defaultValues["ingress"] = {
        className: DEFAULT_INGRESS_CLASS,
        annotations: internalIngressAnnotations(),
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
    if (!hostname) {
      throw new Error("hostname is required for tls");
    }
    setTlsValues(defaultValues, hostname);
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
