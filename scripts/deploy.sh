#!/usr/bin/env bash
# Pulse — server deploy script.
# Run on the server (root@192.168.178.46) inside /root/pulse.
# Pulls latest main, rebuilds shared/backend/frontend, restarts PM2 processes.

set -euo pipefail

REPO_DIR="/root/pulse"
BRANCH="main"
PM2_PROC="pulse"
PM2_FRONTEND_PROC="pulse-frontend"
FRONTEND_CERT_DIR="$REPO_DIR/frontend/certs"
FRONTEND_CERT_KEY="$FRONTEND_CERT_DIR/192.168.178.46+2-key.pem"
FRONTEND_CERT="$FRONTEND_CERT_DIR/192.168.178.46+2.pem"
FRONTEND_ROOT_CA="$FRONTEND_CERT_DIR/rootCA.pem"
FRONTEND_ROOT_CA_KEY="$FRONTEND_CERT_DIR/rootCA-key.pem"
CERT_BACKUP_DIR=""

cleanup_cert_backup() {
  if [[ -n "$CERT_BACKUP_DIR" && -d "$CERT_BACKUP_DIR" ]]; then
    rm -rf "$CERT_BACKUP_DIR"
  fi
}
trap cleanup_cert_backup EXIT

backup_frontend_tls_ca() {
  CERT_BACKUP_DIR="$(mktemp -d)"
  mkdir -p "$CERT_BACKUP_DIR"

  if [[ -f "$FRONTEND_ROOT_CA" ]]; then
    cp -p "$FRONTEND_ROOT_CA" "$CERT_BACKUP_DIR/rootCA.pem"
  fi
  if [[ -f "$FRONTEND_ROOT_CA_KEY" ]]; then
    cp -p "$FRONTEND_ROOT_CA_KEY" "$CERT_BACKUP_DIR/rootCA-key.pem"
  fi
}

restore_frontend_tls_ca() {
  mkdir -p "$FRONTEND_CERT_DIR"

  if [[ ! -f "$FRONTEND_ROOT_CA" && -f "$CERT_BACKUP_DIR/rootCA.pem" ]]; then
    cp -p "$CERT_BACKUP_DIR/rootCA.pem" "$FRONTEND_ROOT_CA"
  fi
  if [[ ! -f "$FRONTEND_ROOT_CA_KEY" && -f "$CERT_BACKUP_DIR/rootCA-key.pem" ]]; then
    cp -p "$CERT_BACKUP_DIR/rootCA-key.pem" "$FRONTEND_ROOT_CA_KEY"
  fi
}

generate_frontend_root_ca() {
  echo "==> creating local frontend root CA"
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout "$FRONTEND_ROOT_CA_KEY" \
    -out "$FRONTEND_ROOT_CA" \
    -subj "/CN=Pulse Local Root CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
}

generate_frontend_leaf_cert() {
  local openssl_config
  local csr
  openssl_config="$(mktemp)"
  csr="$(mktemp)"

  cat > "$openssl_config" <<'EOF'
[req]
distinguished_name = req_distinguished_name
prompt = no

[req_distinguished_name]
CN = 192.168.178.46

[v3_req]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
IP.1 = 192.168.178.46
IP.2 = 127.0.0.1
DNS.1 = localhost
EOF

  echo "==> creating local frontend TLS cert"
  openssl req -new -newkey rsa:2048 -nodes \
    -keyout "$FRONTEND_CERT_KEY" \
    -out "$csr" \
    -subj "/CN=192.168.178.46" \
    -config "$openssl_config"

  openssl x509 -req \
    -in "$csr" \
    -CA "$FRONTEND_ROOT_CA" \
    -CAkey "$FRONTEND_ROOT_CA_KEY" \
    -CAcreateserial \
    -out "$FRONTEND_CERT" \
    -days 825 \
    -sha256 \
    -extensions v3_req \
    -extfile "$openssl_config"

  rm -f "$csr" "$openssl_config" "$FRONTEND_CERT_DIR/rootCA.srl"
  chmod 600 "$FRONTEND_CERT_KEY" "$FRONTEND_ROOT_CA_KEY"
  chmod 644 "$FRONTEND_CERT" "$FRONTEND_ROOT_CA"
}

ensure_frontend_tls_certs() {
  restore_frontend_tls_ca

  if [[ -f "$FRONTEND_CERT_KEY" && -f "$FRONTEND_CERT" ]]; then
    echo "==> frontend TLS certs present"
    return
  fi

  if ! command -v openssl >/dev/null 2>&1; then
    echo "ERROR: frontend TLS certs are missing and openssl is unavailable." >&2
    exit 1
  fi

  if [[ ! -f "$FRONTEND_ROOT_CA" || ! -f "$FRONTEND_ROOT_CA_KEY" ]]; then
    generate_frontend_root_ca
  fi

  generate_frontend_leaf_cert
}

cd "$REPO_DIR"

echo "==> fetching"
git fetch --prune origin

echo "==> verifying clean tree on $BRANCH"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree dirty. Server must be a read-only mirror of origin/$BRANCH." >&2
  git status --short >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "ERROR: server is on '$current_branch', expected '$BRANCH'." >&2
  exit 1
fi

echo "==> fast-forward pull"
backup_frontend_tls_ca
git pull --ff-only origin "$BRANCH"
ensure_frontend_tls_certs

echo "==> install workspace dependencies"
cd "$REPO_DIR"
npm ci --no-audit --no-fund

echo "==> shared build"
npm run build -w shared

echo "==> backend build"
npm run build -w backend

echo "==> frontend build"
npm run build -w frontend

echo "==> database migrations"
npm run db:migrate -w backend

echo "==> pm2 restart $PM2_PROC"
pm2 restart "$PM2_PROC" --update-env

if pm2 describe "$PM2_FRONTEND_PROC" >/dev/null 2>&1; then
  echo "==> pm2 restart $PM2_FRONTEND_PROC"
  pm2 restart "$PM2_FRONTEND_PROC" --update-env
else
  echo "==> pm2 process $PM2_FRONTEND_PROC not found; skipping frontend restart"
fi

echo "==> deploy done: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
