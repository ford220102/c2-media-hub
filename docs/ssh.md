# Safe remote access

SSH is a service on the machine being administered. A website cannot turn it on, and the Hisense C2/VIDAA browser does not expose an SSH API. Use these instructions only on your own Linux Jellyfin/launcher host, not on the projector.

## One-time host setup

1. Install and enable the OpenSSH server using your distribution's package manager and service manager (commonly `openssh-server` and `systemctl enable --now ssh`).
2. Add your public key to the maintenance account's `~/.ssh/authorized_keys`.
3. Confirm a second terminal can log in with the key before changing authentication settings.
4. In `sshd_config`, disable password and root login (`PasswordAuthentication no`, `PermitRootLogin no`), validate the configuration with `sshd -t`, then reload SSH.
5. Limit TCP port 22 to the trusted LAN or VPN with the host/router firewall. Never forward it directly from the public internet.

## Stable access

Reserve the host's IP address in the router's DHCP settings, or use a local DNS name. For access outside the home, use a private VPN such as WireGuard/Tailscale rather than exposing SSH. Keep a local console available until key-based access is verified.

The project deliberately contains no passwords, private keys, automatic port-forwarding, or scripts that weaken SSH authentication.
