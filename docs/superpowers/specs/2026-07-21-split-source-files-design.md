# Split Source Into Multiple Files — Design

## Context

`index.html` has grown to 1560 lines (280 lines CSS, ~1265 lines JS) as a
single file. This splits the *source* into separate files for
maintainability, while keeping the *served* output exactly as it is today:
one bundled HTML response, no new HTTP routes, no build step — the same
approach `server.ts` already uses for `index.html` itself
(`import ... with { type: "text" }`).

This is a pure reorganization: no behavior change, no new features. The
served output must be byte-identical to what's served today (module
ordering doesn't affect behavior here — see Mechanics below).

## File split

- **`styles.css`** — the current `<style>` block's contents, verbatim.
- **`state.js`** — top-level state variables (`view`, `notFound`, `ev`,
  `evId`, `me`, `pendingSeatChange`, `addingPaxFor`, `addingInviteFor`,
  `addingCar`, `editingSeats`, `pendingRemoveCar`, `editingMyLoc`,
  `editingMyNote`, `lastSnapshot`, `pollTimer`), `RAMPS`, and small pure
  helpers with no DOM/storage dependencies: `esc`, `mapLink`, `hash`,
  `uid`, `keyOf`, `initials`.
- **`storage.js`** — the persistence layer: the `window.storage` polyfill
  block, `mem`, `hasStore`, `stGet`/`stSet`/`stList`, `loadEvent`,
  `saveEvent`, `persist` (+ `persistChain`/`pendingWrites`/
  `lastLocalEdit`), `saveMe`, `mutate`.
- **`render.js`** — everything whose job is producing HTML strings or
  deriving data for display: `render`, `renderLanding`, `renderEvent`,
  `carsSummary`, `shareUrl`, `signInPanel`, `youPanel`, `poolRow`,
  `carCard`, `seatLayout`, `carSVG`, `manualMatchBanner`, plus the pure
  data-derivation functions mainly consumed by rendering: `drivers`,
  `occupantsOf`, `carStats`, `carStatsIn`, `pool`, `seatShortage`,
  `orderedStops`, `orderedStopsIn`, `stopInfo`, `manualMatches`.
- **`actions.js`** — everything triggered by user interaction or that
  mutates state/`ev`: `createTrip`, `openEvent`, `backToLanding`,
  `addCar`, `copyShare`, `shareEvent`, `signIn`, `signOut`, `leaveCar`,
  `removeCar`/`confirmRemoveCar`/`cancelRemoveCar`, `claimManual`,
  `dismissManual`, `setSeats`, `confirmSeatChange`, `geoLocate`,
  `flashBtn`, `claimSeat`, `removeFromCar`, `inviteFromPool`,
  `addManualPax`, `moveStop`, `startPolling`, `stopPolling`, `boot`, and
  the trailing `window.addEventListener("hashchange", boot); boot();`
  invocation.

Every function keeps its exact current body — this is a cut-and-paste
reorganization, not a rewrite. No function moves to a different file than
listed above without being called out explicitly if the actual line-by-line
extraction reveals a better fit.

## Mechanics

`index.html` becomes a skeleton with two placeholder comments:

```html
    <style>
/* STYLES_PLACEHOLDER */
    </style>
  ...
    <script>
/* SCRIPT_PLACEHOLDER */
    </script>
```

`server.ts` imports `styles.css`, `state.js`, `storage.js`, `render.js`,
`actions.js`, and the `index.html` skeleton, all as text (`with { type:
"text" }`, the existing pattern), concatenates the four JS files in the
order state → storage → render → actions, and does a plain string
`.replace()` of the two placeholders in the skeleton with the CSS and the
concatenated JS respectively. The result is assigned to the same
`htmlContent` that `Deno.serve` already returns for `/`.

File concatenation order doesn't affect correctness here: every
declaration in these files is either a hoisted `function` declaration
(order-independent) or a top-level `let`/`const`/statement that's only
*read* from inside function bodies which don't execute until `boot()` runs
at the very end of the fully-concatenated script — by which point every
file's top-level statements have already run. The one exception
(`window.storage = {...}` must execute before `const hasStore = ...` reads
it) is self-contained within `storage.js`, so it holds regardless of
`storage.js`'s position in the concatenation order. The state → storage →
render → actions order is chosen for readability, not because a different
order would break anything — except that `actions.js` (containing the
`boot()` call itself) must be concatenated last, since nothing after it
should run before the whole script is defined.

## Verification

Because this is explicitly a no-behavior-change reorganization, the
strongest possible verification is available: capture the current server's
`/` response before touching anything, and after the split, run the
updated server and diff its `/` response against the captured original —
it must be byte-identical.

## Out of scope

- No change to any function's logic, to `server.ts`'s `/api/storage`
  handling, to the deploy workflow beyond adding the new files to what
  `deployctl`/the GitHub-imports static analysis already picks up
  automatically (the same mechanism that already picks up `index.html`).
- No ES modules, no `addEventListener` rewrite, no change to how `onclick`
  attribute handlers resolve function names (they still resolve as
  globals, since none of these files are `type="module"` scripts — they're
  concatenated into one classic script).
