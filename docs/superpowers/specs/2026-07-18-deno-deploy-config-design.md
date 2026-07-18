# Deno Deploy Config — Design

## Context

`carpool-planner` is a single-file Deno server (`server.ts`) that serves an
embedded HTML page and a `/api/storage` endpoint backed by `Deno.openKv()`.
It has no `deno.json`, no CI, and no deploy tooling yet. The goal is to make
it deployable to Deno Deploy via GitHub Actions, and document the process in
the README.

## Approach

Use `deployctl` in a GitHub Actions workflow, triggered on push to `main`,
targeting a Deno Deploy project named `carpool-planner`. A `deno.json` adds
a `start` task for local parity with how Deploy runs the app.

## Files

- **`deno.json`** — `{"tasks": {"start": "deno run --allow-net --allow-env server.ts"}}`.
  `Deno.openKv()` is stable in Deno 2.x, so no `--unstable-kv` flag is
  needed either locally or on Deploy.
- **`.github/workflows/deploy.yml`** — on push to `main`: checkout,
  `denoland/deployctl` GitHub Action, deploy `server.ts` to project
  `carpool-planner`. Requires a `DENO_DEPLOY_TOKEN` repo secret.
- **`README.md`** — new "Deploying" section: how the auto-deploy works,
  the required `DENO_DEPLOY_TOKEN` secret, and the manual
  `deployctl deploy --project=carpool-planner server.ts` command for local
  testing.

## Out of scope

- No changes to `server.ts` — `Deno.serve` already works unmodified on
  Deno Deploy.
- No lint/fmt config, no PR-triggered CI — not requested.
