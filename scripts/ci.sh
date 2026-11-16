#!/bin/sh
# Portable check used by Bitbucket Pipelines and Depot.
# Each step is an npm script so a runner only needs Node and this repo.
set -eu
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
npm run test
npm run build
