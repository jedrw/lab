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
    type = string
    default = env("PROXMOX_USERNAME")
}

variable "token" {
    type = string
    default = env("PROXMOX_TOKEN")
}

source "proxmox-iso" "base-image" {
  node          = "tc-01"
  insecure_skip_tls_verify = true
  proxmox_url   = "https://192.168.20.31:8006/api2/json"
  username      = "${var.username}"
  token         = "${var.token}"

  http_directory = "${path.root}/http"  
  http_port_min = 8000 # Ensure this port is open between VLANs
  http_port_max = 8000
  ssh_username = "jedrw"
  ssh_private_key_file = "~/.ssh/id_rsa"
  boot_wait                = "5s"
  boot_command = ["<wait>e<wait><down><down><down><end> autoinstall ds=nocloud-net\\;s=http://{{.HTTPIP}}:{{.HTTPPort}}/<wait><f10><wait>"]
  unmount_iso   = true

  vm_id         = 8888  
  template_name = "base-image"
  iso_file                 = "storage:iso/ubuntu-24.04-live-server-amd64.iso"
  cores = 2
  memory = 2048
  qemu_agent               = true
  disks {
    disk_size    = "20G"
    storage_pool = "vms"
    type         = "virtio"
  }
  efi_config {
    efi_storage_pool  = "vms"
    pre_enrolled_keys = true
  }
  network_adapters {
    bridge = "vmbr0"
    model  = "virtio"
  }

  cloud_init = true
  cloud_init_storage_pool = "vms"
}

build {
  sources = [
    "source.proxmox-iso.base-image"
  ]

  provisioner "ansible" {
    playbook_file = "../../ansible/base_image.yaml"
  }
}