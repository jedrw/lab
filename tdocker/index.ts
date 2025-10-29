import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import * as doppler from "@pulumiverse/doppler";

import { proxmoxOpts } from "./proxmox";

export = async () => {
  const tdocker = new proxmox.vm.VirtualMachine(
    "tdocker",
    {
      name: "tdocker",
      vmId: 208,
      clone: {
        vmId: 8888,
        datastoreId: "vms",
        full: true,
        nodeName: "tc-01",
        retries: 0,
      },
      nodeName: `tc-01`,
      description: `createdAt: ${new Date().toLocaleString()}`,
      operatingSystem: {
        type: "other",
      },
      bios: "ovmf",
      cpu: {
        cores: 4,
        type: "host",
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
          size: 30,
          cache: "none",
          datastoreId: "vms",
          discard: "on",
          fileFormat: "raw",
        },
        {
          interface: "virtio1",
          size: 50,
          cache: "none",
          datastoreId: "vms",
          discard: "on",
          fileFormat: "raw",
        },
      ],
      cdrom: {},
      serialDevices: [],
      efiDisk: {
        datastoreId: "vms",
        fileFormat: "raw",
        preEnrolledKeys: true,
        type: "4m",
      },
      networkDevices: [
        {
          bridge: "vmbr0",
          model: "virtio",
          firewall: true,
        },
        {
          bridge: "vmbr0",
          model: "virtio",
          firewall: true,
          vlanId: 111,
        },
      ],
      initialization: {
        datastoreId: "local-lvm",
        ipConfigs: [
          {
            ipv4: {
              address: "dhcp",
            },
          },
        ],
      },
    },
    {
      ...proxmoxOpts,
      ignoreChanges: ["description", "disks"],
    }
  );

  const env = await doppler.getSecrets({
    project: "lab",
    config: "prod",
  });

  const tdockerSetupDiff = new pulumi.asset.FileArchive("../ansible/roles/");

  new command.local.Command("tdocker-setup", {
    create: "ansible-playbook -i inventories/production/ tdocker.yaml",
    dir: "../ansible/",
    environment: env.map,
    triggers: [tdocker, tdockerSetupDiff],
  });
};
