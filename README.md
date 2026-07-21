# carpool-planner
A simple carpool planning app inspired by https://www.when2meet.com/

## Running locally

```
deno task start
```

The server serves the frontend at `/` and a KV-backed storage API at
`/api/storage`.

## Deploying

Deploys to [Deno Deploy](https://deno.com/deploy) are manual, via
[`deployctl`](https://deno.com/deploy/docs/deployctl):

```
deployctl deploy --project=carpool-planner server.ts
```

`server.ts` imports `index.html`, `styles.css`, `state.js`, `storage.js`,
`render.js`, and `actions.js` directly as local text files, so `deployctl`
picks them all up automatically — no separate upload step needed.
