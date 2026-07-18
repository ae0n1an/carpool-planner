# Pool-First Signup Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent role-picker form (`detailsPanel()`) with the pool-first flow from `docs/superpowers/specs/2026-07-18-pool-first-signup-flow-design.md`: signing in drops you into the pool with no form, driving is an explicit "+ Add my car" action, and all per-person editing (location, note, flex, meet, seats, leaving-at, sign-out) happens inline where you're already shown (your pool row or your own car card).

**Architecture:** All changes live in `index.html`'s single `<script>` block. Tasks are ordered so each commit leaves the app fully working: Tasks 1-4 add new capability alongside the still-present old form (some transient UI duplication is expected and fine — e.g. the manual-match banner briefly renders in two places between Tasks 2 and 5); Task 5 is the cutover that deletes the old form and its now-dead functions.

**Tech Stack:** Vanilla JS, no build step, no test framework — same as prior work in this repo.

## Global Constraints

- No new files, no external dependencies.
- No change to `geoLocate()`'s reverse-geocoding logic (Nominatim call, fallback chain) — only its hardcoded target-input id becomes a parameter (Task 1).
- No change to the event/car/passenger data model. `role` goes from a 3-way value (`"drive"` / `"ride"` / `null`) to effectively 2-way (`"drive"` / `null`) — no new fields, no migration, since `null` already means "in the pool" today.
- `pool()`, `drivers()`, `carStats()`, `carStatsIn()`, `orderedStops()`, `stopInfo()`, `mutate()`, `saveMe()`, `mapLink()`, `claimSeat()`, `removeFromCar()`, `inviteFromPool()`, `addManualPax()`, `claimManual()`, `dismissManual()`, `manualMatches()`, `carCard()`'s existing passenger-management sections (add-passenger, invite-from-pool, remove-from-car, join/leave, map links) are all unchanged by this plan except where a task explicitly says otherwise.
- This project has no test framework. Verification is one-off Deno extraction scripts for pure logic (mirroring the technique used throughout this project's history) and grep/typecheck/smoke-test checks for markup, plus a rendering-extraction script substituting for a real browser where feasible (see Task 3 and Task 4).
- Preserve existing code style: 2-space indentation, double quotes (deno fmt style).

---

### Task 1: Parameterize `geoLocate()`'s target input

**Files:**
- Modify: `index.html` (`geoLocate()`, its one current call site in `detailsPanel()`)

**Interfaces:**
- Produces: `function geoLocate(btn, inputId)` — same behavior as today, but reads/writes `document.getElementById(inputId)` instead of the hardcoded `"my-loc"`. Later tasks (2, 3, 5) will add new call sites passing their own input ids (`"ac-loc"`, `"ecd-loc"`, `"pr-loc"`); this task only changes the function signature and updates the one existing call site so behavior is unchanged today.

- [ ] **Step 1: Change the function signature and internal lookup**

Find:

```js
      function geoLocate(btn) {
        if (!navigator.geolocation) {
          flashBtn(btn, "Not supported");
          return;
        }
        btn.textContent = "Locating…";
        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude,
              lng = pos.coords.longitude;
            let locStr = lat.toFixed(4) + ", " + lng.toFixed(4);
            try {
              const r = await fetch(
                "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
                  lat +
                  "&lon=" +
                  lng +
                  "&zoom=18&addressdetails=1"
              );
              const d = await r.json();
              const a = d && d.address;
              if (a) {
                const street = [a.house_number, a.road]
                  .filter(Boolean)
                  .join(" ");
                locStr =
                  street ||
                  a.suburb ||
                  a.neighbourhood ||
                  a.city ||
                  a.town ||
                  a.village ||
                  locStr;
              }
            } catch (e) {
              /* keep coordinates — Google Maps understands them fine */
            }
            const inp = document.getElementById("my-loc");
            if (inp) inp.value = locStr;
            btn.disabled = false;
            btn.textContent = "Locate me";
            saveMe({ loc: locStr });
          },
          (err) => {
            btn.disabled = false;
            flashBtn(
              btn,
              err && err.code === 1 ? "No permission" : "Couldn't locate"
            );
          },
          { timeout: 8000 }
        );
      }
```

Replace with (only the signature line and the `document.getElementById` line change):

```js
      function geoLocate(btn, inputId) {
        if (!navigator.geolocation) {
          flashBtn(btn, "Not supported");
          return;
        }
        btn.textContent = "Locating…";
        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude,
              lng = pos.coords.longitude;
            let locStr = lat.toFixed(4) + ", " + lng.toFixed(4);
            try {
              const r = await fetch(
                "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
                  lat +
                  "&lon=" +
                  lng +
                  "&zoom=18&addressdetails=1"
              );
              const d = await r.json();
              const a = d && d.address;
              if (a) {
                const street = [a.house_number, a.road]
                  .filter(Boolean)
                  .join(" ");
                locStr =
                  street ||
                  a.suburb ||
                  a.neighbourhood ||
                  a.city ||
                  a.town ||
                  a.village ||
                  locStr;
              }
            } catch (e) {
              /* keep coordinates — Google Maps understands them fine */
            }
            const inp = document.getElementById(inputId);
            if (inp) inp.value = locStr;
            btn.disabled = false;
            btn.textContent = "Locate me";
            saveMe({ loc: locStr });
          },
          (err) => {
            btn.disabled = false;
            flashBtn(
              btn,
              err && err.code === 1 ? "No permission" : "Couldn't locate"
            );
          },
          { timeout: 8000 }
        );
      }
```

- [ ] **Step 2: Update the one existing call site in `detailsPanel()`**

Find:

```html
          <button class="small" onclick="geoLocate(this)" title="Use my current location">Locate me</button>
```

Replace with:

```html
          <button class="small" onclick="geoLocate(this,'my-loc')" title="Use my current location">Locate me</button>
```

(`detailsPanel()` is deleted wholesale in Task 5 — this call site goes with it. Updating it here keeps the app working correctly for Tasks 1-4, during which `detailsPanel()` is still live.)

- [ ] **Step 3: Verify**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
grep -n "function geoLocate" index.html
grep -n "geoLocate(this" index.html
deno check server.ts
```

Expected: `geoLocate` defined with the new `(btn, inputId)` signature; exactly one `geoLocate(this` call site, now `geoLocate(this,'my-loc')`; typecheck shows only the pre-existing unrelated `err.message` TS18046 error.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Parameterize geoLocate's target input id"
```

---

### Task 2: "+ Add my car" and the relocated manual-match banner

**Files:**
- Modify: `index.html` (`renderEvent()`'s Cars section header; new `addCar()`, `manualMatchBanner()` functions; new `addingCar` state variable)

**Interfaces:**
- Consumes: `mutate(fn)`, `pool()`, `manualMatches()`, `esc()`, `geoLocate(btn, inputId)` (Task 1), `render()`.
- Produces:
  - `let addingCar = false;` — new top-level state variable (boolean, not keyed by id — there's only ever one "add my car" prompt, for the signed-in viewer).
  - `function manualMatchBanner()` → returns the same markup `manualMatches()` currently produces inside `detailsPanel()` (the "X added '[name]' to their car — is that you?" notices with Take-the-seat/Not-me buttons), or `""` if there are none. Later tasks don't depend on this beyond calling it.
  - `async function addCar()` — reads `#ac-seats`/`#ac-loc`, applies `role: "drive"`, `seats`, `loc`, `carOf: null`, `flex: false` to `ev.people[me]` via `mutate()`, closes the form (`addingCar = false`).

- [ ] **Step 1: Add the `addingCar` state variable**

Find:

```js
      let addingInviteFor = null;
```

Replace with:

```js
      let addingInviteFor = null;
      let addingCar = false;
```

- [ ] **Step 2: Add `manualMatchBanner()` right after `manualMatches()`**

Find:

```js
      function manualMatches() {
        const p = ev.people[me];
        if (!p || p.role === "drive" || p.carOf) return [];
        const dismissed = p.dismissed || [];
        const out = [];
        drivers().forEach((dk) => {
          (ev.people[dk].manualPax || []).forEach((m, i) => {
            const mid = m.id || "i" + i;
            if (keyOf(m.n) === me && !dismissed.includes(mid))
              out.push({ dk, mid, m });
          });
        });
        return out;
      }
```

Replace with (adding the new function immediately after):

```js
      function manualMatches() {
        const p = ev.people[me];
        if (!p || p.role === "drive" || p.carOf) return [];
        const dismissed = p.dismissed || [];
        const out = [];
        drivers().forEach((dk) => {
          (ev.people[dk].manualPax || []).forEach((m, i) => {
            const mid = m.id || "i" + i;
            if (keyOf(m.n) === me && !dismissed.includes(mid))
              out.push({ dk, mid, m });
          });
        });
        return out;
      }
      function manualMatchBanner() {
        return manualMatches()
          .map(
            (x) => `<div class="notice">${esc(ev.people[x.dk].name)} added "${esc(
              x.m.n
            )}"${x.m.loc ? ` (${esc(x.m.loc)})` : ""} to their car — is that you?
        <div class="row" style="margin-top:8px;">
          <button class="small primary" onclick="claimManual('${x.dk}','${
              x.mid
            }')">Take the seat</button>
          <button class="small" onclick="dismissManual('${
              x.mid
            }')">Not me</button>
        </div></div>`
          )
          .join("");
      }
```

- [ ] **Step 3: Add `addCar()` right after `carsSummary()`**

Find:

```js
      function carsSummary() {
        if (!drivers().length) return "";
        let cap = 0,
          used = 0;
        drivers().forEach((dk) => {
          const s = carStats(dk);
          cap += s.cap;
          used += s.used;
        });
        return `<span class="muted" style="font-weight:400;">— ${used} of ${cap} seats filled</span>`;
      }
```

Replace with (adding the new function immediately after):

```js
      function carsSummary() {
        if (!drivers().length) return "";
        let cap = 0,
          used = 0;
        drivers().forEach((dk) => {
          const s = carStats(dk);
          cap += s.cap;
          used += s.used;
        });
        return `<span class="muted" style="font-weight:400;">— ${used} of ${cap} seats filled</span>`;
      }

      async function addCar() {
        const seatsInput = document.getElementById("ac-seats");
        const locInput = document.getElementById("ac-loc");
        const seats = Math.max(
          1,
          Math.min(12, parseInt(seatsInput.value, 10) || 1)
        );
        const loc = locInput.value.trim();
        addingCar = false;
        await mutate((e) => {
          const p = e.people[me];
          p.role = "drive";
          p.seats = seats;
          p.loc = loc;
          p.carOf = null;
          p.flex = false;
        });
      }
```

- [ ] **Step 4: Wire the banner and the "+ Add my car" button/form into the Cars section header**

Find:

```html
        <div class="row" style="justify-content:space-between; margin-bottom:10px; flex-wrap:wrap;">
          <h2>Cars ${carsSummary()}</h2>
          <div class="legend">
            <span><span class="sw" style="background:var(--teal);"></span> signed up</span>
            <span><span class="sw" style="background:var(--amber);"></span> added by driver</span>
            <span><span class="sw" style="border:1.5px dashed var(--border-strong);"></span> open</span>
          </div>
        </div>
        ${
          drivers().length
            ? `<div class="cars">${drivers()
                .map((dk, i) => carCard(dk, i))
                .join("")}</div>`
            : `<div class="card muted">No cars yet — the first person to pick "I can drive" creates one.</div>`
        }
```

Replace with:

```html
        <div class="row" style="justify-content:space-between; margin-bottom:10px; flex-wrap:wrap;">
          <h2>Cars ${carsSummary()}</h2>
          <div class="legend">
            <span><span class="sw" style="background:var(--teal);"></span> signed up</span>
            <span><span class="sw" style="background:var(--amber);"></span> added by driver</span>
            <span><span class="sw" style="border:1.5px dashed var(--border-strong);"></span> open</span>
          </div>
        </div>
        ${manualMatchBanner()}
        ${
          me && ev.people[me].role !== "drive"
            ? `<div class="row" style="margin-bottom:10px;">
          <button class="small primary" onclick="addingCar=true; render();">+ Add my car</button>
        </div>`
            : ""
        }
        ${
          addingCar
            ? `<div class="card" style="margin-bottom:14px;">
          <div class="field"><label>Passenger seats (excl. you) *</label>
            <input type="number" id="ac-seats" min="1" max="12" value="4"></div>
          <div class="field"><label>Departing from *</label>
            <div class="row">
              <input type="text" id="ac-loc" placeholder="Full street address" style="flex:1; min-width:0;">
              <button class="small" onclick="geoLocate(this,'ac-loc')" title="Use my current location">Locate me</button>
            </div>
          </div>
          <div class="row">
            <button class="small primary" onclick="addCar()">Add my car</button>
            <button class="small" onclick="addingCar=false; render();">Cancel</button>
          </div>
        </div>`
            : ""
        }
        ${
          drivers().length
            ? `<div class="cars">${drivers()
                .map((dk, i) => carCard(dk, i))
                .join("")}</div>`
            : `<div class="card muted">No cars yet — the first person to add one creates it.</div>`
        }
```

Note: `manualMatchBanner()` will render **twice** right now — once here, once still inside `detailsPanel()` — until Task 5 deletes `detailsPanel()`. This is expected transient duplication, not a bug in this task.

- [ ] **Step 5: Verify with an isolated Deno script exercising `addCar`'s mutation logic**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno eval '
function addCarLogic(e, me, seats, loc) {
  const p = e.people[me];
  p.role = "drive";
  p.seats = seats;
  p.loc = loc;
  p.carOf = null;
  p.flex = false;
}

let e = { people: {
  alice: { role: null, seats: 4, loc: "", carOf: null, flex: true },
} };
addCarLogic(e, "alice", 3, "42 Example St");
console.log(JSON.stringify(e.people.alice));
console.log(
  e.people.alice.role === "drive" &&
    e.people.alice.seats === 3 &&
    e.people.alice.loc === "42 Example St" &&
    e.people.alice.carOf === null &&
    e.people.alice.flex === false
    ? "PASS"
    : "FAIL"
);
'
```

Expected: prints the updated object, then `PASS`.

- [ ] **Step 6: Typecheck and smoke-test**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t2.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t2.log
```

Expected: typecheck shows only the pre-existing unrelated error; curl prints `200`; log shows the server started with no runtime errors.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Add +Add-my-car flow and relocate manual-match banner to Cars section"
```

---

### Task 3: Car-card controls for the driver — seats, edit details, remove car

**Files:**
- Modify: `index.html` (`carCard()`; new `saveCarDetails()`, `removeCar()`, `confirmRemoveCar()`, `cancelRemoveCar()` functions; new `editingCarFor`, `pendingRemoveCar` state variables)

**Interfaces:**
- Consumes: `mutate(fn)`, `saveMe(patch)`, `setSeats(inp)` (unchanged, existing), `carStats(dk)`, `esc()`, `geoLocate(btn, inputId)` (Task 1).
- Produces:
  - `let editingCarFor = null;` / `let pendingRemoveCar = false;` — new top-level state variables, same pattern as `addingPaxFor`/`addingInviteFor`.
  - `async function saveCarDetails(dk)` — reads `#ecd-loc`/`#ecd-leave`/`#ecd-note`, writes `loc`/`leaveAt`/`note` onto `ev.people[dk]` via `mutate()`, closes the form (`editingCarFor = null`).
  - `function removeCar()` — if `carStats(me).used > 0`, sets `pendingRemoveCar = true` and re-renders (confirmation required); otherwise calls `confirmRemoveCar()` directly.
  - `async function confirmRemoveCar()` — clears `pendingRemoveCar`, then via `mutate()`: unsets `carOf` on anyone whose `carOf === me`, and sets `ev.people[me].role = null`, `manualPax = []`, `paxOrder = []`. (Same effective mutation `confirmRoleSwitch()` performs today for a driver switching away — this is that same logic, scoped to "remove my car" instead of "switch to some other role".)
  - `function cancelRemoveCar()` — clears `pendingRemoveCar`, re-renders.

- [ ] **Step 1: Add the two new state variables**

Find:

```js
      let addingCar = false;
```

Replace with:

```js
      let addingCar = false;
      let editingCarFor = null;
      let pendingRemoveCar = false;
```

(This assumes Task 2 already landed, adding `addingCar`. If for some reason it's not present, add `editingCarFor`/`pendingRemoveCar` directly after `addingInviteFor` instead.)

- [ ] **Step 2: Add `saveCarDetails()` right after `confirmSeatChange()`**

Find the end of `confirmSeatChange()` — it's the function directly before `geoLocate()`:

```js
      function confirmSeatChange() {
        const v = pendingSeatChange;
        pendingSeatChange = null;
        mutate((e) => {
          const d = e.people[me];
          d.seats = v;
          let guard = 20;
          while (guard-- > 0) {
            const order = orderedStopsIn(e, me);
            if (order.length <= v) break;
            const id = order[order.length - 1];
            if (id.startsWith("p:")) {
              const p = e.people[id.slice(2)];
              if (p) p.carOf = null;
            } else {
              const key = id.slice(2);
              d.manualPax = (d.manualPax || []).filter(
                (m, i) => (m.id || "i" + i) !== key
              );
            }
            d.paxOrder = (d.paxOrder || []).filter((x) => x !== id);
          }
        });
      }

      function geoLocate(btn, inputId) {
```

Replace with (adding `saveCarDetails` between them):

```js
      function confirmSeatChange() {
        const v = pendingSeatChange;
        pendingSeatChange = null;
        mutate((e) => {
          const d = e.people[me];
          d.seats = v;
          let guard = 20;
          while (guard-- > 0) {
            const order = orderedStopsIn(e, me);
            if (order.length <= v) break;
            const id = order[order.length - 1];
            if (id.startsWith("p:")) {
              const p = e.people[id.slice(2)];
              if (p) p.carOf = null;
            } else {
              const key = id.slice(2);
              d.manualPax = (d.manualPax || []).filter(
                (m, i) => (m.id || "i" + i) !== key
              );
            }
            d.paxOrder = (d.paxOrder || []).filter((x) => x !== id);
          }
        });
      }

      async function saveCarDetails(dk) {
        const loc = document.getElementById("ecd-loc").value.trim();
        const leaveAt = document.getElementById("ecd-leave").value;
        const note = document.getElementById("ecd-note").value.trim();
        editingCarFor = null;
        await mutate((e) => {
          const d = e.people[dk];
          d.loc = loc;
          d.leaveAt = leaveAt;
          d.note = note;
        });
      }

      function geoLocate(btn, inputId) {
```

- [ ] **Step 3: Add `removeCar()`/`confirmRemoveCar()`/`cancelRemoveCar()` right after `leaveCar()`**

Find:

```js
      async function leaveCar() {
        await saveMe({ carOf: null });
      }
```

Replace with:

```js
      async function leaveCar() {
        await saveMe({ carOf: null });
      }

      function removeCar() {
        if (carStats(me).used > 0) {
          pendingRemoveCar = true;
          render();
          return;
        }
        confirmRemoveCar();
      }
      async function confirmRemoveCar() {
        pendingRemoveCar = false;
        await mutate((e) => {
          Object.keys(e.people).forEach((k) => {
            if (e.people[k].carOf === me) e.people[k].carOf = null;
          });
          const p = e.people[me];
          p.role = null;
          p.manualPax = [];
          p.paxOrder = [];
        });
      }
      function cancelRemoveCar() {
        pendingRemoveCar = false;
        render();
      }
```

- [ ] **Step 4: Wire the seats control, confirm blocks, edit-details toggle/form, and remove-car button into `carCard()`**

Find (the header row and note paragraph near the top of `carCard()`'s returned template):

```js
        return `<div class="card" style="padding:12px;">
    <div class="row" style="justify-content:space-between; margin-bottom:2px;">
      <div>
        <span style="font-weight:600; font-size:14px;">${esc(
          d.name
        )}'s car &middot; ${stats.cap + 1} seats</span>
        <p class="muted" style="margin:0;">${
          d.loc ? mapLink(d.loc) : "start TBC"
        }${
          ev.dest ? ` → ${mapLink(ev.dest)}` : ""
        }${
          d.leaveAt
            ? ` &middot; departs <b style="color:var(--text);">${esc(
                d.leaveAt
              )}</b>`
            : " &middot; time TBC"
        }</p>
      </div>
      <span class="badge" style="background:${ramp.l}; color:${ramp.d};">${
          stats.used
        }/${stats.cap}</span>
    </div>
    ${
      d.note
        ? `<p class="muted" style="font-style:italic; margin:4px 0 6px;">"${esc(
            d.note
          )}"</p>`
        : ""
    }
```

Replace with:

```js
        let carConfirmBlock = "";
        if (mine && pendingSeatChange != null) {
          const excess = stats.used - pendingSeatChange;
          carConfirmBlock += `<div class="notice">Dropping to ${pendingSeatChange} seat${
            pendingSeatChange > 1 ? "s" : ""
          } removes your last ${excess} passenger${
            excess > 1 ? "s" : ""
          } — they go back to the pool.
      <div class="row" style="margin-top:8px;">
        <button class="small danger" onclick="confirmSeatChange()">Reduce seats</button>
        <button class="small" onclick="pendingSeatChange=null; render();">Cancel</button>
      </div></div>`;
        }
        if (mine && pendingRemoveCar) {
          carConfirmBlock += `<div class="notice">Removing your car sends your ${stats.used} passenger${
            stats.used > 1 ? "s" : ""
          } back to the pool.
      <div class="row" style="margin-top:8px;">
        <button class="small danger" onclick="confirmRemoveCar()">Remove anyway</button>
        <button class="small" onclick="cancelRemoveCar()">Cancel</button>
      </div></div>`;
        }
        let carDetailsForm = "";
        if (editingCarFor === dk && mine) {
          carDetailsForm = `<div style="margin-top:8px; padding:8px; background:var(--bg); border-radius:var(--radius);">
      <div class="field"><label>Departing from *</label>
        <div class="row">
          <input type="text" id="ecd-loc" value="${esc(
            d.loc
          )}" placeholder="Full street address" style="flex:1; min-width:0;">
          <button class="small" onclick="geoLocate(this,'ecd-loc')" title="Use my current location">Locate me</button>
        </div>
      </div>
      <div class="field"><label>Leaving at</label>
        <input type="time" id="ecd-leave" value="${esc(d.leaveAt)}"></div>
      <div class="field"><label>Note for the group</label>
        <input type="text" id="ecd-note" value="${esc(
          d.note
        )}" placeholder="Bringing a cooler"></div>
      <div class="row">
        <button class="small primary" onclick="saveCarDetails('${dk}')">Save</button>
        <button class="small" onclick="editingCarFor=null; render();">Cancel</button>
      </div>
    </div>`;
        }
        return `<div class="card" style="padding:12px;">
    <div class="row" style="justify-content:space-between; margin-bottom:2px;">
      <div>
        <span style="font-weight:600; font-size:14px;">${esc(
          d.name
        )}'s car &middot; ${stats.cap + 1} seats</span>
        <p class="muted" style="margin:0;">${
          d.loc ? mapLink(d.loc) : "start TBC"
        }${
          ev.dest ? ` → ${mapLink(ev.dest)}` : ""
        }${
          d.leaveAt
            ? ` &middot; departs <b style="color:var(--text);">${esc(
                d.leaveAt
              )}</b>`
            : " &middot; time TBC"
        }</p>
      </div>
      ${
        mine
          ? `<span class="row" style="gap:4px;">
        <input type="number" min="1" max="12" value="${esc(
          d.seats
        )}" style="width:56px; padding:4px 6px;" onchange="setSeats(this)" aria-label="Passenger seats">
        <span class="badge" style="background:${ramp.l}; color:${ramp.d};">${
              stats.used
            }/${stats.cap}</span>
      </span>`
          : `<span class="badge" style="background:${ramp.l}; color:${ramp.d};">${
              stats.used
            }/${stats.cap}</span>`
      }
    </div>
    ${carConfirmBlock}
    ${
      d.note
        ? `<p class="muted" style="font-style:italic; margin:4px 0 6px;">"${esc(
            d.note
          )}"</p>`
        : ""
    }
```

- [ ] **Step 5: Add "Edit car details" / "Remove my car" buttons and render the new form, next to the existing mine-only controls**

Find:

```js
        ${
          mine
            ? `<div class="row" style="margin-top:6px;">
          <button class="small" onclick="addingPaxFor='${dk}'; render();">+ Add passenger</button>
          <button class="small" onclick="addingInviteFor='${dk}'; render();">+ Invite from pool</button>
        </div>`
            : ""
        }
        ${addForm}
        ${inviteForm}
      </div>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="small" style="flex:1;" onclick="window.open('${mapsUrl}','_blank')">Open in Google Maps</button>
      ${joinLeave}
    </div>
  </div>`;
```

Replace with:

```js
        ${
          mine
            ? `<div class="row" style="margin-top:6px; flex-wrap:wrap;">
          <button class="small" onclick="addingPaxFor='${dk}'; render();">+ Add passenger</button>
          <button class="small" onclick="addingInviteFor='${dk}'; render();">+ Invite from pool</button>
          <button class="small" onclick="editingCarFor=editingCarFor==='${dk}'?null:'${dk}'; render();">Edit car details</button>
          <button class="small danger" onclick="removeCar()">Remove my car</button>
        </div>`
            : ""
        }
        ${addForm}
        ${inviteForm}
        ${carDetailsForm}
      </div>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="small" style="flex:1;" onclick="window.open('${mapsUrl}','_blank')">Open in Google Maps</button>
      ${joinLeave}
    </div>
  </div>`;
```

- [ ] **Step 6: Verify with an isolated Deno script exercising the new mutation logic**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno eval '
function saveCarDetailsLogic(e, dk, loc, leaveAt, note) {
  const d = e.people[dk];
  d.loc = loc;
  d.leaveAt = leaveAt;
  d.note = note;
}

function confirmRemoveCarLogic(e, me) {
  Object.keys(e.people).forEach((k) => {
    if (e.people[k].carOf === me) e.people[k].carOf = null;
  });
  const p = e.people[me];
  p.role = null;
  p.manualPax = [];
  p.paxOrder = [];
}

let e = { people: {
  alice: { loc: "old", leaveAt: "", note: "" },
} };
saveCarDetailsLogic(e, "alice", "42 Example St", "08:30", "Bringing snacks");
console.log("saveCarDetails:", JSON.stringify(e.people.alice));
console.log(
  e.people.alice.loc === "42 Example St" &&
    e.people.alice.leaveAt === "08:30" &&
    e.people.alice.note === "Bringing snacks"
    ? "PASS"
    : "FAIL"
);

e = { people: {
  alice: { role: "drive", manualPax: [{ id: "m1", n: "Bob" }], paxOrder: ["p:carol", "m:m1"] },
  carol: { role: null, carOf: "alice" },
} };
confirmRemoveCarLogic(e, "alice");
console.log("confirmRemoveCar:", JSON.stringify(e));
console.log(
  e.people.alice.role === null &&
    e.people.alice.manualPax.length === 0 &&
    e.people.alice.paxOrder.length === 0 &&
    e.people.carol.carOf === null
    ? "PASS"
    : "FAIL"
);
'
```

Expected: both blocks print `PASS`.

- [ ] **Step 7: Typecheck and smoke-test**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t3.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t3.log
```

Expected: typecheck shows only the pre-existing unrelated error; curl prints `200`; no runtime errors in the log.

- [ ] **Step 8: If possible, extend Task 3's verification with a `carCard()` rendering-extraction script**

Following the same technique used for the previous car-card rewrite in this project (extract `carCard`, `stopInfo`, `mapLink`, `esc`, stub `carSVG`, build fake `ev`/`me` state), assert the returned HTML contains: the seats `<input>` when `mine`, the plain badge when not `mine`, "Edit car details" and "Remove my car" buttons only when `mine`, the `carDetailsForm` markup when `editingCarFor === dk`, and the `pendingRemoveCar`/`pendingSeatChange` confirm notices when those flags are set. If extraction proves too entangled to do cleanly, report exactly what's blocking it and mark the task `DONE_WITH_CONCERNS` — do not skip verification silently.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "Add seats/edit-details/remove-car controls to the driver's own car card"
```

---

### Task 4: Rewrite `poolRow()` — editable for you, read-only for others

**Files:**
- Modify: `index.html` (`poolRow()`)

**Interfaces:**
- Consumes: `esc()`, `mapLink()`, `initials()`, `saveMe(patch)`, `signOut()`, `geoLocate(btn, inputId)` (Task 1).
- Produces: `poolRow(k)`'s signature and call site (`pool().map(poolRow)`) are unchanged — same function, same single argument, called the same way.

- [ ] **Step 1: Replace `poolRow()` in full**

Find:

```js
      function poolRow(k) {
        const p = ev.people[k];
        const undecided = !p.role;
        const flexBadge = p.flex
          ? `<span class="badge" style="background:var(--amber-l); color:var(--amber-d);">can drive &middot; ${esc(
              p.seats
            )} seats</span>`
          : "";
        const meetBadge = p.meet
          ? `<span class="badge" style="background:var(--blue-l); color:var(--blue-d);">will meet anywhere</span>`
          : "";
        const undBadge = undecided
          ? `<span class="badge" style="background:var(--bg); color:var(--text2); border:1px solid var(--border);">undecided</span>`
          : "";
        return `<div class="pool-row">
    <div class="avatar" style="background:${
      p.flex ? "var(--amber-l)" : "var(--blue-l)"
    }; color:${p.flex ? "var(--amber-d)" : "var(--blue-d)"};">${initials(
          p.name
        )}</div>
    <div style="flex:1; min-width:0;">
      <div style="font-size:13px; font-weight:600;">${esc(
        p.name
      )} ${flexBadge} ${meetBadge} ${undBadge}</div>
      <div class="muted">${p.loc ? esc(p.loc) : "location TBC"}${
          p.note ? ` &middot; <i>"${esc(p.note)}"</i>` : ""
        }</div>
    </div>
  </div>`;
      }
```

Replace with:

```js
      function poolRow(k) {
        const p = ev.people[k];
        const mine = k === me;
        const flexBadge = p.flex
          ? `<span class="badge" style="background:var(--amber-l); color:var(--amber-d);">can drive &middot; ${esc(
              p.seats
            )} seats</span>`
          : "";
        const meetBadge = p.meet
          ? `<span class="badge" style="background:var(--blue-l); color:var(--blue-d);">will meet anywhere</span>`
          : "";
        if (mine) {
          return `<div class="pool-row" style="align-items:flex-start;">
    <div class="avatar" style="background:${
      p.flex ? "var(--amber-l)" : "var(--blue-l)"
    }; color:${p.flex ? "var(--amber-d)" : "var(--blue-d)"};">${initials(
            p.name
          )}</div>
    <div style="flex:1; min-width:0;">
      <div class="row" style="justify-content:space-between;">
        <div style="font-size:13px; font-weight:600;">${esc(
          p.name
        )} ${flexBadge} ${meetBadge}</div>
        <button class="small" onclick="signOut()">Sign out</button>
      </div>
      <div class="row" style="margin-top:6px;">
        <input type="text" id="pr-loc" value="${esc(
          p.loc
        )}" placeholder="Full street address" style="flex:1; min-width:0;" onchange="saveMe({loc:this.value.trim()})">
        <button class="small" onclick="geoLocate(this,'pr-loc')" title="Use my current location">Locate me</button>
      </div>
      <input type="text" value="${esc(
        p.note
      )}" placeholder="Bringing a cooler" style="margin-top:6px; width:100%;" onchange="saveMe({note:this.value.trim()})">
      <label class="opt" style="display:flex; gap:8px; font-size:13px; color:var(--text2); margin-top:6px; cursor:pointer;">
        <input type="checkbox" ${
          p.flex ? "checked" : ""
        } onchange="saveMe({flex:this.checked})"> Could drive if needed</label>
      <label class="opt" style="display:flex; gap:8px; font-size:13px; color:var(--text2); margin-top:4px; cursor:pointer;">
        <input type="checkbox" ${
          p.meet ? "checked" : ""
        } onchange="saveMe({meet:this.checked})"> Happy to meet the car somewhere convenient</label>
    </div>
  </div>`;
        }
        return `<div class="pool-row">
    <div class="avatar" style="background:${
      p.flex ? "var(--amber-l)" : "var(--blue-l)"
    }; color:${p.flex ? "var(--amber-d)" : "var(--blue-d)"};">${initials(
          p.name
        )}</div>
    <div style="flex:1; min-width:0;">
      <div style="font-size:13px; font-weight:600;">${esc(
        p.name
      )} ${flexBadge} ${meetBadge}</div>
      <div class="muted">${p.loc ? mapLink(p.loc) : "location TBC"}${
          p.note ? ` &middot; <i>"${esc(p.note)}"</i>` : ""
        }</div>
    </div>
  </div>`;
      }
```

- [ ] **Step 2: Verify with an isolated Deno script**

This function is pure string templating over plain data — extract it (plus `esc`, `mapLink`, `initials`) into an isolated script and assert on the output for three cases: someone else with a location (expect a `mapLink`-produced `<a href=` in the output, no `<input>` tags), yourself (expect `<input id="pr-loc"` and `onclick="signOut()"` in the output), someone else with no `role` set (expect no "undecided" badge text anywhere in the output — confirms the dropped distinction).

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
sed -n '/^      function esc(/,/^      }/p' index.html > /tmp/poolrow_deps.js
sed -n '/^      function initials(/,/^      }/p' index.html >> /tmp/poolrow_deps.js
sed -n '/^      function mapLink(/,/^      }/p' index.html >> /tmp/poolrow_deps.js
sed -n '/^      function poolRow(/,/^      }/p' index.html >> /tmp/poolrow_deps.js
deno eval "
let me = 'alice';
let ev = { people: {
  alice: { name: 'Alice', flex: false, meet: false, loc: '1 Test St', note: '', seats: 4 },
  bob: { name: 'Bob', role: null, flex: false, meet: false, loc: '2 Test Ave', note: '', seats: 4 },
} };
$(cat /tmp/poolrow_deps.js)
const mine = poolRow('alice');
const other = poolRow('bob');
console.log('mine has pr-loc input:', mine.includes('id=\"pr-loc\"'));
console.log('mine has sign out:', mine.includes('onclick=\"signOut()\"'));
console.log('other has map link:', other.includes('<a href='));
console.log('other has no input:', !other.includes('<input'));
console.log('other has no undecided badge:', !other.includes('undecided'));
"
rm -f /tmp/poolrow_deps.js
```

Expected: all five lines print `true`.

- [ ] **Step 3: Typecheck and smoke-test**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t4.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t4.log
```

Expected: typecheck shows only the pre-existing unrelated error; curl prints `200`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Make pool rows editable for you, read-only for others"
```

---

### Task 5: Cutover — remove the old form, collapse the layout, delete dead code

**Files:**
- Modify: `index.html` (`renderEvent()`'s grid; delete `detailsPanel()`, `setRole()`, `applyRole()`, `confirmRoleSwitch()`, `cancelRoleSwitch()`; delete the `pendingRoleSwitch` state variable)

**Interfaces:**
- Consumes: `signInPanel()` (unchanged), everything built in Tasks 1-4.
- Produces: nothing new — this task only removes code and adjusts layout. After this task, `detailsPanel`, `setRole`, `applyRole`, `confirmRoleSwitch`, `cancelRoleSwitch`, and `pendingRoleSwitch` must not appear anywhere in `index.html`.

- [ ] **Step 1: Confirm nothing outside the code being deleted still references it**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
grep -n "detailsPanel\|setRole(\|applyRole(\|confirmRoleSwitch\|cancelRoleSwitch\|pendingRoleSwitch" index.html
```

Expected at this point (before this task's edits): `detailsPanel()`'s definition and its one call site in `renderEvent()`; `setRole`/`applyRole`/`confirmRoleSwitch`/`cancelRoleSwitch`'s definitions and their `onchange`/`onclick` references, all inside `detailsPanel()`'s own template; `pendingRoleSwitch`'s declaration and its two uses (both inside `detailsPanel()`/`setRole()`/`confirmRoleSwitch()`/`cancelRoleSwitch()`). If anything on this list is referenced from a file location outside what Steps 2-4 below remove, STOP and report NEEDS_CONTEXT — that means something added in a later task depends on old code this task is about to delete.

- [ ] **Step 2: Collapse the grid to single-column when signed in, and stop rendering `detailsPanel()`**

Find:

```html
    <div class="grid">
      <div>${me ? detailsPanel() : signInPanel()}</div>
      <div>
```

Replace with:

```html
    <div class="grid"${me ? ' style="grid-template-columns:1fr;"' : ""}>
      ${me ? "" : `<div>${signInPanel()}</div>`}
      <div>
```

- [ ] **Step 3: Delete the `pendingRoleSwitch` state variable**

Find:

```js
      let pendingRoleSwitch = null;
      let pendingSeatChange = null;
```

Replace with:

```js
      let pendingSeatChange = null;
```

- [ ] **Step 4: Delete `detailsPanel()`, `setRole()`, `applyRole()`, `confirmRoleSwitch()`, `cancelRoleSwitch()` in full**

Find (from the `/* ---------- details panel ---------- */` comment through the end of `cancelRoleSwitch()`, right before `async function leaveCar()`):

```js
      /* ---------- details panel ---------- */
      function detailsPanel() {
        const p = ev.people[me];
        const isDrive = p.role === "drive";
        const isRide = p.role === "ride";
        const showSeats = isDrive || (isRide && p.flex);
        const stats = isDrive ? carStats(me) : null;
        let confirmBlock = "";
        if (pendingRoleSwitch) {
          confirmBlock = `<div class="notice">Switching to "${
            pendingRoleSwitch === "ride" ? "I need a ride" : "driver"
          }" removes your car — your ${carStats(me).used} passenger${
            carStats(me).used > 1 ? "s" : ""
          } go back to the pool.
      <div class="row" style="margin-top:8px;">
        <button class="small danger" onclick="confirmRoleSwitch()">Switch anyway</button>
        <button class="small" onclick="cancelRoleSwitch()">Cancel</button>
      </div></div>`;
        }
        if (pendingSeatChange != null) {
          const excess = carStats(me).used - pendingSeatChange;
          confirmBlock += `<div class="notice">Dropping to ${pendingSeatChange} seat${
            pendingSeatChange > 1 ? "s" : ""
          } removes your last ${excess} passenger${
            excess > 1 ? "s" : ""
          } — they go back to the pool.
      <div class="row" style="margin-top:8px;">
        <button class="small danger" onclick="confirmSeatChange()">Reduce seats</button>
        <button class="small" onclick="pendingSeatChange=null; render();">Cancel</button>
      </div></div>`;
        }
        return `<div class="card">
    <div class="row" style="justify-content:space-between; margin-bottom:12px;">
      <div class="row">
        <div class="avatar" style="background:var(--blue-l); color:var(--blue-d);">${initials(
          p.name
        )}</div>
        <span style="font-weight:600; font-size:14px;">${esc(p.name)}</span>
      </div>
      <button class="small" onclick="signOut()">Sign out</button>
    </div>
    <div style="border-top:1px solid var(--border); padding-top:12px;">
      ${manualMatches()
        .map(
          (x) => `<div class="notice">${esc(ev.people[x.dk].name)} added "${esc(
            x.m.n
          )}"${x.m.loc ? ` (${esc(x.m.loc)})` : ""} to their car — is that you?
        <div class="row" style="margin-top:8px;">
          <button class="small primary" onclick="claimManual('${x.dk}','${
            x.mid
          }')">Take the seat</button>
          <button class="small" onclick="dismissManual('${
            x.mid
          }')">Not me</button>
        </div></div>`
        )
        .join("")}
      ${confirmBlock}
      <div class="radio-box" style="margin-bottom:12px;">
        <label class="opt"><input type="radio" name="role" ${
          isDrive ? "checked" : ""
        } onchange="setRole('drive')"> I can drive</label>
        <label class="opt"><input type="radio" name="role" ${
          isRide ? "checked" : ""
        } onchange="setRole('ride')"> I need a ride</label>
        ${
          isRide
            ? `<label class="opt" style="margin-left:24px; font-size:13px; color:var(--text2);">
            <input type="checkbox" ${
              p.flex ? "checked" : ""
            } onchange="saveMe({flex:this.checked})"> &hellip;but I can drive if needed</label>`
            : ""
        }
        ${
          showSeats
            ? `<div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border);">
          <label>${
            isDrive
              ? "Passenger seats (excl. you) *"
              : "Seats if you end up driving"
          }</label>
          <input type="number" min="1" max="12" value="${esc(
            p.seats
          )}" onchange="setSeats(this)">
        </div>`
            : ""
        }
      </div>
      <div class="field">
        <label>${isDrive ? "Departing from *" : "Pickup location *"}</label>
        <div class="row">
          <input type="text" id="my-loc" value="${esc(
            p.loc
          )}" placeholder="Full street address" style="flex:1; min-width:0;" onchange="saveMe({loc:this.value.trim()})">
          <button class="small" onclick="geoLocate(this,'my-loc')" title="Use my current location">Locate me</button>
        </div>
      </div>
      ${
        !isDrive
          ? `<label class="opt" style="display:flex; gap:8px; font-size:13px; color:var(--text2); margin-bottom:10px; cursor:pointer;">
        <input type="checkbox" ${
          p.meet ? "checked" : ""
        } onchange="saveMe({meet:this.checked})"> Happy to meet the car somewhere convenient</label>`
          : ""
      }
      ${
        isDrive
          ? `<div class="field"><label>Leaving at</label>
        <input type="time" value="${esc(
          p.leaveAt
        )}" onchange="saveMe({leaveAt:this.value})">
        ${
          ev.arriveBy
            ? `<p class="tiny" style="margin:4px 0 0;">Event target: arrive by ${esc(
                ev.arriveBy
              )}.</p>`
            : ""
        }
      </div>`
          : ""
      }
      <div class="field"><label>Note for the group</label>
        <input type="text" value="${esc(
          p.note
        )}" placeholder="Bringing a cooler" onchange="saveMe({note:this.value.trim()})"></div>
      ${
        p.carOf && ev.people[p.carOf]
          ? `<div class="field">
        <p class="muted" style="margin:0 0 6px;">You're in ${esc(
          ev.people[p.carOf].name
        )}'s car.</p></div>`
          : ""
      }
      <p class="tiny">Changes save automatically.</p>
    </div>
  </div>`;
      }

      function setRole(role) {
        const p = ev.people[me];
        if (p.role === "drive" && role !== "drive" && carStats(me).used > 0) {
          pendingRoleSwitch = role;
          render();
          return;
        }
        applyRole(role);
      }
      async function applyRole(role) {
        await mutate((e) => {
          const p = e.people[me];
          p.role = role;
          if (role === "drive") {
            p.carOf = null;
            p.flex = false;
          }
        });
      }
      async function confirmRoleSwitch() {
        const role = pendingRoleSwitch;
        pendingRoleSwitch = null;
        await mutate((e) => {
          Object.keys(e.people).forEach((k) => {
            if (e.people[k].carOf === me) e.people[k].carOf = null;
          });
          const p = e.people[me];
          p.role = role;
          p.manualPax = [];
          p.paxOrder = [];
        });
      }
      function cancelRoleSwitch() {
        pendingRoleSwitch = null;
        render();
      }

      async function leaveCar() {
```

Replace with:

```js
      async function leaveCar() {
```

(This deletes `detailsPanel`, `setRole`, `applyRole`, `confirmRoleSwitch`, `cancelRoleSwitch` entirely, keeping `leaveCar()` — unchanged — as the next function.)

- [ ] **Step 5: Update the "No cars yet" message** (if Task 2 hasn't already updated it to the version below — check first)

Confirm the message reads `"No cars yet — the first person to add one creates it."` (set by Task 2, Step 4). If it still reads the old `"...the first person to pick \"I can drive\" creates one."`, update it now — that phrase no longer makes sense with the form gone.

- [ ] **Step 6: Verify nothing was left behind**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
grep -n "detailsPanel\|setRole(\|applyRole(\|confirmRoleSwitch\|cancelRoleSwitch\|pendingRoleSwitch\|isRide\|I need a ride\|I can drive\b" index.html
```

Expected: no matches at all. (`"I can drive"` as a literal phrase should no longer appear anywhere — the radio button copy is gone, and the pool row's checkbox now reads "Could drive if needed" instead.)

- [ ] **Step 7: Typecheck and smoke-test**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t5.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t5.log
```

Expected: typecheck shows only the pre-existing unrelated error; curl prints `200`; no runtime errors.

- [ ] **Step 8: Verify the manual-match banner no longer renders twice**

The literal notice text `"to their car — is that you?"` exists in two places in the source before this task (`manualMatchBanner()`'s template, added in Task 2, and `detailsPanel()`'s original inline duplicate) and should exist in exactly one place after Step 4 deletes `detailsPanel()`:

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
grep -c "to their car — is that you?" index.html
```

Expected: `1`.

Expected: `1` (the call site added in Task 2's Cars-section header — `detailsPanel()`, which had the only other copy of this markup, is now gone).

- [ ] **Step 9: Manual browser check (layout/interaction changes a grep can't fully cover)**

Run `deno task start`, open `http://localhost:8000/` in a browser, create a trip, sign in:
- Confirm you land directly in "Not in a car yet" with no form, and the grid is single-column (no empty left-hand gap).
- Edit your own pool row's location, note, and both checkboxes; confirm they save (reload the page, confirm they persisted).
- Click "+ Add my car", fill in seats + location, submit; confirm a car card appears with you as driver, and you're no longer in the pool.
- On your own car card: change the seat count down below your current passenger count (add a passenger first via "+ Add passenger" to have something to test with) and confirm the reduce-seats confirmation appears; use "Edit car details" to change location/leaving-at/note and confirm Save persists them; use "Remove my car" with a passenger in the car and confirm the confirmation notice appears and, on confirming, you're back in the pool and the passenger is back in the pool too.
- In a second browser/incognito session, sign in as someone else, and confirm their own row is editable while the first person's row (and car) is read-only/appropriately interactive (join button, map links, etc.) from their perspective.

Note in the plan-execution log which of these were confirmed working.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "Remove the role-picker form; pool-first signup flow is now the only flow"
```

---

## Final Verification (after all tasks)

- [ ] `deno check server.ts` — only the pre-existing `err.message` TS18046 error should remain.
- [ ] `grep -n "detailsPanel\|pendingRoleSwitch\|setRole(\|applyRole(" index.html` — no matches.
- [ ] Full manual walkthrough per Task 5 Step 9, including the two-browser check.
- [ ] `git log --oneline -6` shows the five task commits.
