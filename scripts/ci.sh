#!/bin/sh
# Portable check used by Depot and any other runner.
# Each step is an npm script so a runner only needs Node and this repo.
# Browser checks (npm run test:browser, npm run e2e) need Chromium and run in their own job.
set -eu
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
npm run test:coverage
npm run build
