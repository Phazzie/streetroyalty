#!/bin/sh
# Portable check used by Vercel, Bitbucket Pipelines, and Depot.
# Each step is an npm script so a runner only needs Node and this repo.
set -eu
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
# Tests run as a test environment whatever the host sets. One of them reads NODE_ENV,
# and a build host may set it to production.
NODE_ENV=test npm run test
npm run build
