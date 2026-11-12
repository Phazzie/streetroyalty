#!/bin/sh
# Portable check used by GitHub Actions and, later, Depot or Buildkite.
# Each step is an npm script so a runner only needs Node and this repo.
set -eu
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
npm run test
npm run build
