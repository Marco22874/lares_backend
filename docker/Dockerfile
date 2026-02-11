# Dockerfile - Lares Cohousing Backend
# Custom Directus image with extensions
#
# Author: Lares Cohousing Dev Team
# Date: 2026-02-11

FROM directus/directus:11

# Copy custom extensions
COPY directus/extensions /directus/extensions

# Copy snapshot for schema migration
COPY directus/snapshots /directus/snapshots

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s \
  --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 \
  --spider http://localhost:8055/server/health \
  || exit 1

EXPOSE 8055
