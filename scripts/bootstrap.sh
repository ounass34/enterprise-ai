#!/usr/bin/env bash
set -euo pipefail
cp -n .env.example .env || true
mkdir -p models/piper
printf '\nEnterprise AI bootstrap complete. Edit .env before production use.\n'
