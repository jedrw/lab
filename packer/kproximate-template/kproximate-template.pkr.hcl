// This currently doesn't work due to kp-nodes provisioned from this template using localhost
// for their hostname instead of the name configured in proxmox. Current using the example script
// from the kproximate repo. TODO :(

packer {
  required_plugins {
    proxmox = {
      version = "~> 1"
      source  = "github.com/hashicorp/proxmox"
    }

    ansible = {
      version = "~> 1"
      source  = "github.com/hashicorp/ansible"
    }
  }
}

variable "username" {
  type    = string
  default = env("PROXMOX_USERNAME")
}

variable "token" {
  type    = string
  default = env("PROXMOX_TOKEN")
}

source "proxmox-iso" "kproximate-template" {
  node                     = "tc-01"
  insecure_skip_tls_verify = true
  proxmox_url              = "https://192.168.20.31:8006/api2/json"
  username                 = "${var.username}"
  token                    = "${var.token}"

  http_directory       = "${path.root}/../http"
  http_port_min        = 8000 # Ensure this port is open between VLANs
  http_port_max        = 8000
  ssh_username         = "jedrw"
  ssh_private_key_file = "~/.ssh/id_rsa"
  ssh_timeout          = "10m"
  boot_wait            = "5s"
  boot_command         = ["<wait>e<wait><down><down><down><end> autoinstall ds=nocloud-net\\;s=http://{{.HTTPIP}}:{{.HTTPPort}}/<wait><f10><wait>"]
  unmount_iso          = true

  vm_id         = 900
  template_name = "kproximate-template"
  template_description = "createdAt: ${timestamp()}"
  iso_file      = "storage:iso/ubuntu-24.04-live-server-amd64.iso"
  cores         = 2
  cpu_type      = "host"
  memory        = 2048
  bios          = "ovmf"
  qemu_agent    = true
  scsi_controller = "virtio-scsi-single"
  cloud_init    = true
  cloud_init_storage_pool = "vms"
  disks {
    disk_size    = "10G"
    storage_pool = "vms"
    type         = "virtio"
  }
  efi_config {
    efi_storage_pool  = "vms"
    pre_enrolled_keys = true
  }
  network_adapters {
    bridge   = "vmbr0"
    model    = "virtio"
    vlan_tag = 200
    firewall = true
  }
}

build {
  sources = [
    "source.proxmox-iso.kproximate-template"
  ]

  provisioner "ansible" {
    playbook_file = "../../ansible/kproximate_template.yaml"
  }
}