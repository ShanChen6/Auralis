#!/bin/sh
set -e
# Áp migration trước khi chạy (tắt bằng RUN_MIGRATIONS=false nếu dùng pre-deploy command riêng)
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node node_modules/prisma/build/index.js migrate deploy
fi
exec node dist/main.js
