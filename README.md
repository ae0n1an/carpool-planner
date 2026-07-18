# carpool-planner
A simple carpool planning app inspired by https://www.when2meet.com/

## Running locally

```
deno task start
```

The server serves the frontend at `/` and a KV-backed storage API at
`/api/storage`.

## Deploying

This repo auto-deploys to [Deno Deploy](https://deno.com/deploy) via GitHub
Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):
every push to `main` deploys `server.ts` to the `carpool-planner` project.

To set this up:

1. Create a project named `carpool-planner` on Deno Deploy.
2. Generate a Deno Deploy access token and add it to this repo's secrets as
   `DENO_DEPLOY_TOKEN` (Settings → Secrets and variables → Actions).
3. Push to `main` — the workflow deploys automatically.

To deploy manually instead:

```
deployctl deploy --project=carpool-planner server.ts
```
