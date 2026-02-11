#!/bin/bash
# ============================================
# backup.sh
# Author: Lares Cohousing Dev Team
# Date: 2026-02-11
# Description: PostgreSQL backup script for
#              Lares Cohousing database.
#              Intended for daily cron execution.
#
# Usage: ./scripts/backup.sh
# Cron:  0 2 * * * /path/to/backup.sh
#
# Update History:
#   2026-02-11 - Initial creation
# ============================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/lares}"
DB_CONTAINER="${DB_CONTAINER:-lares-db}"
DB_NAME="${DB_DATABASE:-lares}"
DB_USER="${DB_USER:-directus}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/lares_${TIMESTAMP}.sql.gz"

# Create backup directory if needed
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup..."

# Dump and compress
docker exec "${DB_CONTAINER}" \
  pg_dump -U "${DB_USER}" "${DB_NAME}" \
  | gzip > "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[$(date)] Backup created: ${BACKUP_FILE} (${SIZE})"
else
  echo "[$(date)] ERROR: Backup failed!"
  exit 1
fi

# Remove old backups
find "${BACKUP_DIR}" \
  -name "lares_*.sql.gz" \
  -mtime +"${RETENTION_DAYS}" \
  -delete

echo "[$(date)] Cleanup done. Backups older than ${RETENTION_DAYS} days removed."
echo "[$(date)] Backup complete."
