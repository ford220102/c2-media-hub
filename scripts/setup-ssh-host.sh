#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Uruchom jako root: sudo $0 <użytkownik> <klucz-publiczny>" >&2
  exit 1
fi

ssh_user=${1:-}
public_key=${2:-}
if [[ ! ${ssh_user} =~ ^[a-z_][a-z0-9_-]{0,31}$ ]]; then
  echo "Podaj istniejącego użytkownika Linux jako pierwszy argument." >&2
  exit 1
fi
if [[ ! ${public_key} =~ ^ssh-(ed25519|rsa)[[:space:]] ]]; then
  echo "Podaj cały publiczny klucz SSH jako drugi argument (nigdy klucz prywatny)." >&2
  exit 1
fi
user_home=$(getent passwd "${ssh_user}" | cut -d: -f6)
if [[ -z ${user_home} || ! -d ${user_home} ]]; then
  echo "Użytkownik ${ssh_user} nie istnieje." >&2
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y openssh-server
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y openssh-server
elif command -v pacman >/dev/null 2>&1; then
  pacman -S --needed --noconfirm openssh
else
  echo "Nieobsługiwany menedżer pakietów. Zainstaluj OpenSSH Server ręcznie." >&2
  exit 1
fi

install -d -m 700 -o "${ssh_user}" -g "$(id -gn "${ssh_user}")" "${user_home}/.ssh"
touch "${user_home}/.ssh/authorized_keys"
if ! grep -Fqx -- "${public_key}" "${user_home}/.ssh/authorized_keys"; then
  printf '%s\n' "${public_key}" >> "${user_home}/.ssh/authorized_keys"
fi
chown "${ssh_user}:$(id -gn "${ssh_user}")" "${user_home}/.ssh/authorized_keys"
chmod 600 "${user_home}/.ssh/authorized_keys"

install -d -m 755 /etc/ssh/sshd_config.d
printf '%s\n' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PermitRootLogin no' > /etc/ssh/sshd_config.d/90-c2-media-hub.conf
sshd -t
if systemctl list-unit-files ssh.service >/dev/null 2>&1; then
  systemctl enable --now ssh.service
else
  systemctl enable --now sshd.service
fi

host_ip=$(hostname -I | awk '{print $1}')
echo "SSH aktywne po restarcie: ssh ${ssh_user}@${host_ip}"
echo "Nie przekierowuj portu 22 w routerze; używaj LAN lub prywatnego VPN."
