#!/usr/bin/env bash
# Build the Team Pulse image for Ubuntu x86-64 (linux/amd64) — works from Apple Silicon too.
#
#   ./scripts/docker-build.sh                    # → team-pulse:latest, loaded into local Docker
#   ./scripts/docker-build.sh 1.0.0              # → team-pulse:1.0.0
#   OUTPUT=tar ./scripts/docker-build.sh 1.0.0   # → team-pulse-1.0.0-amd64.tar (copy to the server)
#   IMAGE=registry.example.com/team-pulse OUTPUT=push ./scripts/docker-build.sh 1.0.0
set -euo pipefail

TAG="${1:-latest}"
IMAGE="${IMAGE:-team-pulse}"
PLATFORM="linux/amd64"
OUTPUT="${OUTPUT:-load}"   # load | tar | push

cd "$(dirname "$0")/.."

# A buildx builder that can cross-build (uses QEMU emulation on non-x86 hosts).
if ! docker buildx inspect team-pulse-builder >/dev/null 2>&1; then
  docker buildx create --name team-pulse-builder --driver docker-container >/dev/null
fi

case "$OUTPUT" in
  load) OUT_FLAG=(--load) ;;
  push) OUT_FLAG=(--push) ;;
  tar)  OUT_FLAG=(--output "type=docker,dest=${IMAGE##*/}-${TAG}-amd64.tar") ;;
  *) echo "OUTPUT must be load, tar or push" >&2; exit 1 ;;
esac

docker buildx build \
  --builder team-pulse-builder \
  --platform "$PLATFORM" \
  --pull \
  --provenance=true \
  --sbom=true \
  --tag "${IMAGE}:${TAG}" \
  "${OUT_FLAG[@]}" \
  .

echo "Built ${IMAGE}:${TAG} for ${PLATFORM} (${OUTPUT})"
