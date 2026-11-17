#!/bin/sh
# Portable check used by Vercel, Bitbucket Pipelines, and Depot.
# Each step is an npm script so a runner only needs Node and this repo.
# Browser checks (npm run test:browser, npm run e2e) need Chromium and run in their own job.
set -eu
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
# Tests run as a test environment whatever the host sets. One of them reads NODE_ENV,
# and a build host may set it to production.
# They also run without the host's database. The integration tests empty every table
# before each test, so here they always use the in-memory one. A build host such as
# Vercel hands the build the real DATABASE_URL, and the tests must never see it.
DATABASE_URL= NODE_ENV=test npm run test:coverage
npm run build
