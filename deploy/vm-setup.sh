#!/usr/bin/env bash
#
# Eventia — idempotent provisioning for an Oracle Cloud Always Free VM (Ubuntu 24.04, aarch64).
#
# Safe to re-run: every step checks for its own end state before acting.
#
# Usage:
#   sudo bash deploy/vm-setup.sh
#
set -euo pipefail

readonly SWAP_SIZE_GB="${SWAP_SIZE_GB:-4}"
readonly APP_DIR="${APP_DIR:-/opt/eventia}"
readonly ENV_FILE="${APP_DIR}/deploy/.env"
readonly CADDY_DATA_DIR="${APP_DIR}/deploy/caddy-data"
readonly CADDY_CONFIG_DIR="${APP_DIR}/deploy/caddy-config"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

require_root() {
  [[ ${EUID} -eq 0 ]] || die "run as root: sudo bash deploy/vm-setup.sh"
}

require_ubuntu_arm64() {
  [[ -r /etc/os-release ]] || die "/etc/os-release not found"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ ${ID:-} == ubuntu ]] || die "Ubuntu required (found: ${ID:-unknown})"
  case "$(uname -m)" in
    aarch64 | arm64) ;;
    *) warn "$(uname -m) is not aarch64 — expected on Oracle A1.Flex; continuing anyway" ;;
  esac
}

install_prereqs() {
  local missing=()
  command -v curl >/dev/null 2>&1 || missing+=(curl)
  command -v openssl >/dev/null 2>&1 || missing+=(openssl)
  if (( ${#missing[@]} > 0 )); then
    log "installing prerequisites: ${missing[*]}"
    apt-get update -qq
    apt-get install -y -qq "${missing[@]}"
  fi
}

setup_swap() {
  local swapfile=/swapfile
  if swapon --show=NAME --noheadings | grep -q .; then
    log "swap already active, skipping"
    return
  fi
  log "creating ${swapfile} (${SWAP_SIZE_GB}G)"
  if [[ -f ${swapfile} ]]; then
    warn "${swapfile} exists but is not enabled; recreating"
    swapoff "${swapfile}" 2>/dev/null || true
    rm -f "${swapfile}"
  fi
  fallocate -l "${SWAP_SIZE_GB}G" "${swapfile}"
  chmod 600 "${swapfile}"
  mkswap "${swapfile}" >/dev/null
  swapon "${swapfile}"
  grep -q "^${swapfile} " /etc/fstab || printf '%s none swap sw 0 0\n' "${swapfile}" >> /etc/fstab
  swapon --show
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log "docker already installed ($(docker --version))"
  else
    log "installing docker engine"
    apt-get update -qq
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
  fi
  command -v docker >/dev/null 2>&1 || die "docker install did not produce a docker binary"
  systemctl enable --now docker
}

install_compose_plugin() {
  if docker compose version >/dev/null 2>&1; then
    log "docker compose plugin already installed ($(docker compose version --short))"
    return
  fi
  local arch dest
  # Docker Compose names its assets after uname values, so arm64 must map to
  # aarch64: docker-compose-linux-arm64 does not exist.
  case "$(uname -m)" in
    aarch64 | arm64) arch=aarch64 ;;
    x86_64 | amd64) arch=x86_64 ;;
    *) die "unsupported architecture for the compose plugin: $(uname -m)" ;;
  esac
  dest=/usr/local/lib/docker/cli-plugins/docker-compose
  base="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}"
  log "installing docker compose plugin (${arch})"
  mkdir -p "$(dirname "${dest}")"
  curl -fsSL "${base}" -o "${dest}"
  # The published .sha256 names the upstream asset, not our destination, so
  # compare the digests directly rather than using `sha256sum -c`.
  local expected actual
  expected="$(curl -fsSL "${base}.sha256" | awk '{print $1}')"
  actual="$(sha256sum "${dest}" | awk '{print $1}')"
  if [[ -z ${expected} || ${expected} != "${actual}" ]]; then
    rm -f "${dest}"
    die "compose plugin checksum mismatch (expected ${expected:-none}, got ${actual}) — refusing to install"
  fi
  chmod +x "${dest}"
  docker compose version || die "compose plugin installed but not usable"
}

setup_firewall() {
  command -v ufw >/dev/null 2>&1 || { apt-get install -y -qq ufw; }
  log "configuring ufw: 22, 80, 443/tcp, 443/udp"
  ufw allow 22/tcp comment 'ssh'
  ufw allow 80/tcp comment 'http (acme + redirect)'
  ufw allow 443/tcp comment 'https'
  ufw allow 443/udp comment 'https (http/3)'
  ufw --force enable
  ufw status verbose
}

setup_app_dirs() {
  log "creating ${APP_DIR} layout"
  mkdir -p "${APP_DIR}/deploy" "${CADDY_DATA_DIR}" "${CADDY_CONFIG_DIR}"
}

random_hex() { openssl rand -hex 32; }

setup_env_file() {
  if [[ -f ${ENV_FILE} ]]; then
    log "keeping existing ${ENV_FILE} (not overwriting)"
    return
  fi
  log "generating ${ENV_FILE}"
  local pg_pass access refresh admin_pass
  pg_pass="$(random_hex)"
  access="$(random_hex)"
  refresh="$(random_hex)"
  admin_pass="Ev-$(random_hex | cut -c1-16)"
  cat > "${ENV_FILE}" <<EOF
POSTGRES_DB=eventia
POSTGRES_USER=eventia
POSTGRES_PASSWORD=${pg_pass}

JWT_ACCESS_SECRET=${access}
JWT_REFRESH_SECRET=${refresh}

PUBLIC_SITE_ADDRESS=https://REPLACE_WITH_YOUR_PUBLIC_IP
PUBLIC_ORIGIN=https://REPLACE_WITH_YOUR_PUBLIC_IP
ACME_EMAIL=you@example.com
TRUST_PROXY_HOPS=1

SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=${admin_pass}
ENABLE_API_DOCS=false
MAIL_DRAIN_INTERVAL_MS=15000
EOF
  chmod 600 "${ENV_FILE}"
  warn "edit ${ENV_FILE}: set PUBLIC_SITE_ADDRESS, PUBLIC_ORIGIN and ACME_EMAIL before starting"
  printf '\n  seeded admin password: %s\n' "${admin_pass}"
}

verify_compose_config() {
  [[ -f ${APP_DIR}/compose.yml ]] || {
    warn "${APP_DIR}/compose.yml not found — clone the repo there first, skipping verification"
    return
  }
  command -v docker >/dev/null 2>&1 || { warn "docker unavailable, skipping"; return; }
  [[ -f ${ENV_FILE} ]] || { warn "${ENV_FILE} missing, skipping"; return; }
  log "verifying compose configuration"
  local unresolved
  unresolved="$(grep -n 'REPLACE_WITH' "${ENV_FILE}" || true)"
  if [[ -n ${unresolved} ]]; then
    warn "unresolved placeholders left in ${ENV_FILE}:"
    printf '%s\n' "${unresolved}" >&2
    die "fill in every REPLACE_WITH_* value before starting the stack"
  fi
  (cd "${APP_DIR}" && docker compose --env-file deploy/.env config -q) \
    || die "compose config is invalid — fix ${ENV_FILE} and re-run"
  log "compose configuration valid"
}

main() {
  require_root
  require_ubuntu_arm64
  install_prereqs
  setup_swap
  install_docker
  install_compose_plugin
  setup_firewall
  setup_app_dirs
  setup_env_file
  verify_compose_config
  log "done"
  cat <<'EOF'

Next steps:
  1. Clone the repo into APP_DIR (default /opt/eventia) if it is not there yet.
  2. Edit deploy/.env: PUBLIC_SITE_ADDRESS, PUBLIC_ORIGIN, ACME_EMAIL, SEED_ADMIN_*.
  3. Ensure the Oracle VCN security list allows TCP 22/80/443 and UDP 443.
  4. Start the stack:
       docker compose --env-file deploy/.env up -d --build
  5. Seed demo data once (optional):
       docker compose --env-file deploy/.env run --rm \
         -e SEED_ADMIN_EMAIL=admin@example.com -e SEED_ADMIN_PASSWORD='<password>' \
         --entrypoint node backend dist/seed.js
  6. Check: curl -fsS https://<public-ip>/api/v1/health
EOF
}

main "$@"
