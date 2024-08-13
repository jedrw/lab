import * as yaml from "yaml";
import * as fs from "fs";
import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as doppler from "@pulumiverse/doppler";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import { proxmoxOpts } from "../proxmox";
import { buildK3sOpts } from "../kubernetes";

export async function buildCluster(): Promise<pulumi.Resource[]> {
  let cluster: proxmox.vm.VirtualMachine[] = [];

  const inventoryFile = fs.readFileSync(
    "../../ansible/inventories/production/hosts",
    "utf8",
  );

  const clusterNodes = yaml.parse(inventoryFile).all.children.tk3s.hosts;

  for (const nodeName in clusterNodes) {
    const nodeNumber = +nodeName.split("-")[2];
    cluster.push(
      new proxmox.vm.VirtualMachine(
        nodeName,
        {
          name: nodeName,
          vmId: 2000 + nodeNumber,
          clone: {
            vmId: 8888,
            datastoreId: "vms",
            full: true,
            nodeName: "tc-01",
            retries: 0,
          },
          nodeName: `tc-0${nodeNumber}`,
          description: `createdAt: ${new Date().toLocaleString()}`,
          operatingSystem: {
            type: "other",
          },
          bios: "ovmf",
          cpu: {
            cores: 2,
            type: "host",
            units: 100,
          },
          memory: {
            dedicated: 4096,
          },
          vga: { type: "std" },
          onBoot: true,
          bootOrders: ["virtio0", "net0"],
          started: true,
          agent: { enabled: true, trim: true },
          scsiHardware: "virtio-scsi-single",
          disks: [
            {
              interface: "virtio0",
              size: 20,
              cache: "none",
              datastoreId: "vms",
              discard: "on",
              fileFormat: "raw",
            },
          ],
          cdrom: { enabled: false },
          serialDevices: [],
          efiDisk: {
            datastoreId: "vms",
            fileFormat: "raw",
            preEnrolledKeys: true,
            type: "4m",
          },
          networkDevices: [
            {
              vlanId: 200,
              macAddress: clusterNodes[nodeName]["mac"],
              bridge: "vmbr0",
              model: "virtio",
              firewall: true,
            },
          ],
          initialization: {
            datastoreId: "local-lvm",
            ipConfigs: [
              {
                ipv4: {
                  address: "dhcp",
                  gateway: "",
                },
              },
            ],
          },
        },
        {
          ...proxmoxOpts,
          // bugs with disk speed :(
          // ignoreChanges: ["description", "disks[0].speed"],
          ignoreChanges: ["description"],
        },
      ),
    );
  }

  let env = await doppler.getSecrets({
    project: "lupinecluster_infrastructure",
    config: "prod",
  });

  const clusterSetupDiff = new pulumi.asset.FileArchive(
    "../../ansible/roles/k3s/",
  );

  const clusterSetup = new command.local.Command("tk3s-setup", {
    create: "ansible-playbook -i inventories/production/ tk3s.yaml",
    dir: "../../ansible/",
    environment: env.map,
    triggers: [cluster, clusterSetupDiff],
  });

  const generateKubeconfigDiff = new pulumi.asset.FileArchive(
    "../../ansible/roles/kubeconfig/",
  );

  const generateKubeconfig = new command.local.Command(
    `generate-${process.env["USERNAME"]}-kubeconfig`,
    {
      create: "ansible-playbook -i inventories/production/ kubeconfig.yaml",
      dir: "../../ansible/",
      environment: env.map,
      triggers: [generateKubeconfigDiff],
    },
    { dependsOn: [clusterSetup] },
  );

  const kubeconfig = new command.remote.Command(
    `${process.env["USERNAME"]}-kubeconfig`,
    {
      create: "cat /var/lib/rancher/k3s/gen/jedrw/kube/config",
      connection: {
        host: "k-c-01.lupinedmz",
        user: process.env["USERNAME"],
        privateKey: fs.readFileSync(
          `/home/${process.env["USERNAME"]}/.ssh/id_rsa`,
          "utf8",
        ),
      },
      logging: command.remote.Logging.Stderr,
      triggers: [generateKubeconfig.stdout],
    },
  );

  buildK3sOpts(kubeconfig.stdout);

  return cluster;
}
