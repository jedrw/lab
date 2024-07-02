terraform {
  required_providers {
    proxmox = {
      source  = "telmate/proxmox"
      version = "3.0.1-rc3"
    }
  }
}

provider "proxmox" {
  pm_api_url          = "https://192.168.20.31:8006/api2/json"
  pm_api_token_id     = var.proxmox_username
  pm_api_token_secret = var.proxmox_token
}

variable "proxmox_username" {
  type = string
}

variable "proxmox_token" {
  type = string
}

variable "username" {
  type        = string
  description = "Username"
}

variable "ssh_user_public_key" {
  type        = string
  description = "User public ssh key"
}

resource "proxmox_vm_qemu" "k3s-control-plane" {
  count       = 3
  agent       = 1
  vmid        = "200${count.index + 1}"
  desc        = "createdAt: ${timestamp()}"
  bios        = "ovmf"
  cores       = 2
  memory      = 2048
  balloon     = 1024
  onboot      = true
  boot        = "order=virtio0;net0"
  vm_state    = "running"
  scsihw      = "virtio-scsi-single"
  startup     = ""
  clone       = "base-image"
  full_clone  = true
  name        = "k-c-0${count.index + 1}"
  target_node = "tc-0${count.index + 1}"
  ipconfig0   = "ip=dhcp"
  tags        = "prod,k3s"

  disks {
    virtio {
      virtio0 {
        disk {
          backup  = true
          cache   = "none"
          discard = true
          format  = "raw"
          size    = "20G"
          storage = "vms"
        }
      }
    }
  }

  network {
    bridge    = "vmbr0"
    firewall  = true
    link_down = false
    model     = "virtio"
    mtu       = 0
    queues    = 0
    rate      = 0
    tag       = 200
  }

  lifecycle {
    ignore_changes = [desc]
  }
}

