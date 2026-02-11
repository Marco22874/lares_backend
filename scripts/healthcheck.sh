#!/bin/bash
# ============================================
# healthcheck.sh
# Author: Lares Cohousing Dev Team
# Date: 2026-02-11
# Description: Healthcheck script for monitoring
#              Directus backend availability.
#
# Usage: ./scripts/healthcheck.sh
# Returns: exit 0 if healthy, exit 1 if not
#
# Update History:
#   2026-02-11 - Initial creation
# ============================================

set -euo pipefail

DIRECTUS_URL="${DIRECTUS_URL:-http://localhost:8055}"
TIMEOUT=10

HTTP_CODE=$(curl -s -o /dev/null \
  -w "%{http_code}" \
  --max-time "${TIMEOUT}" \
  "${DIRECTUS_URL}/server/health" 2>/dev/null || echo "000")

if [ "${HTTP_CODE}" = "200" ]; then
  echo "OK - Directus is healthy"
  exit 0
else
  echo "FAIL - Directus returned HTTP ${HTTP_CODE}"
  exit 1
fi
