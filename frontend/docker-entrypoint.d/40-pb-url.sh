#!/bin/sh
# Replace the build-time placeholder PocketBase URL in the compiled JS bundle
# with the runtime value of POCKETBASE_HOST, so the published image can point at
# any PocketBase instance without being rebuilt.
#
# nginx runs every executable *.sh in /docker-entrypoint.d/ at container startup,
# before the server boots.
set -e

PLACEHOLDER="http://pb.home-planner.localhost"

if [ -z "$POCKETBASE_HOST" ]; then
  echo "40-pb-url.sh: POCKETBASE_HOST is not set, keeping placeholder PocketBase URL ($PLACEHOLDER)"
  exit 0
fi

# Scheme defaults to https (secure-by-default for public deployments); set
# POCKETBASE_SCHEME=http for the local HTTP-only stack.
SCHEME="${POCKETBASE_SCHEME:-https}"
TARGET="${SCHEME}://${POCKETBASE_HOST}"
echo "40-pb-url.sh: setting PocketBase URL to ${TARGET}"

# Use | as the sed delimiter since the URLs contain / and :.
find /usr/share/nginx/html -type f -name '*.js' -exec \
  sed -i "s|${PLACEHOLDER}|${TARGET}|g" {} +
