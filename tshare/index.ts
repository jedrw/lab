import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as doppler from "@pulumiverse/doppler";

import { proxmoxOpts } from "./proxmox";

export = async () => {
  const tshare = new proxmox.vm.VirtualMachine(
    "tshare",
    {
      name: "tshare",
      vmId: 205,
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
        cores: 2,
        type: "host",
        units: 100,
      },
      memory: {
        dedicated: 2048,
        floating: 1024,
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
        {
          interface: "virtio1",
          size: 250,
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
          bridge: "vmbr0",
          macAddress: "bc:24:11:f9:5f:2f",
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
            },
          },
        ],
      },
    },
    {
      ...proxmoxOpts,
      ignoreChanges: ["description"],
    }
  );

  const env = await doppler.getSecrets({
    project: "lupinecluster_infrastructure",
    config: "prod",
  });

  const tshareSetupDiff = new pulumi.asset.FileArchive("../ansible/roles/");

  new command.local.Command("tshare-setup", {
    create: "ansible-playbook -i inventories/production/ tshare.yaml",
    dir: "../ansible/",
    environment: env.map,
    triggers: [tshare, tshareSetupDiff],
  });
};
