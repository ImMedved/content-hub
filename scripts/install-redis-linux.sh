#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
        exec sudo bash "$0" "$@"
    fi

    echo "Run this script as root or install sudo." >&2
    exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "This script supports Debian/Ubuntu servers with apt-get." >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y redis-server

REDIS_CONF="/etc/redis/redis.conf"

sed -i 's/^supervised .*/supervised systemd/' "$REDIS_CONF"
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$REDIS_CONF"
sed -i 's/^protected-mode .*/protected-mode yes/' "$REDIS_CONF"

systemctl enable redis-server
systemctl restart redis-server
systemctl --no-pager --full status redis-server || true

redis-cli ping
