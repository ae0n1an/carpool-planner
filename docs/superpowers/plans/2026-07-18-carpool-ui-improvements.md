# Carpool Planner UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the nine UI/UX improvements from `docs/superpowers/specs/2026-07-18-carpool-ui-improvements-design.md` — copy polish, passenger note visibility, car-card join/leave/invite/remove actions, and clickable map locations — entirely within `index.html`.

**Architecture:** All changes live in the single `<script>` block in `index.html`. `server.ts` already imports `index.html` as a text module (`import htmlContent from "./index.html" with { type: "text" };`), so no server-side changes or re-encoding are needed — editing `index.html` is sufficient for both local dev and deploy.

**Tech Stack:** Vanilla JS, no build step, no test framework. `deno` (2.9.3, installed at `~/.deno/bin/deno`) is available for running one-off verification scripts.

## Global Constraints

- No new files, no external dependencies (no geocoding/autocomplete API, per spec's "out of scope").
- No change to the existing `geoLocate()` reverse-geocoding flow.
- No change to the event/car/passenger data model or the `mutate()`/`saveMe()`/`persist()` persistence pattern.
- This project has no test framework. "Tests" in this plan are one-off Deno verification scripts (extracting the relevant function(s) into an isolated harness, the same technique already used earlier in this project for `stGet`/`stSet`) for pure logic, and start-the-server-and-grep checks for rendered HTML output. Every task must still be verified before moving on — just not via a test runner.
- Preserve existing code style: 2-space indentation, double quotes (the file is `deno fmt`-formatted).

---

### Task 1: Copy polish — placeholders, share-link text, location guidance

**Files:**
- Modify: `index.html` (`renderLanding()`, `detailsPanel()`)

**Interfaces:** None — pure string/template literal edits, no new functions.

- [ ] **Step 1: Replace the trip-name and destination placeholders in `renderLanding()`**

In `index.html`, inside `renderLanding()`, find:

```html
      <div class="field"><label>Trip name</label><input type="text" id="c-name" placeholder="Torquay surf trip"></div>
      <div class="field"><label>Date</label><input type="date" id="c-date"></div>
      <div class="field"><label>Destination</label><input type="text" id="c-dest" placeholder="Torquay"></div>
```

Replace with:

```html
      <div class="field"><label>Trip name</label><input type="text" id="c-name" placeholder="Weekend trip"></div>
      <div class="field"><label>Date</label><input type="date" id="c-date"></div>
      <div class="field"><label>Destination</label><input type="text" id="c-dest" placeholder="Blue Mountains"></div>
```

- [ ] **Step 2: Replace the note placeholder and tighten the location placeholder in `detailsPanel()`**

Find:

```html
          <input type="text" id="my-loc" value="${esc(
            p.loc
          )}" placeholder="Address or suburb" style="flex:1; min-width:0;" onchange="saveMe({loc:this.value.trim()})">
```

Replace with:

```html
          <input type="text" id="my-loc" value="${esc(
            p.loc
          )}" placeholder="Full street address" style="flex:1; min-width:0;" onchange="saveMe({loc:this.value.trim()})">
```

Find:

```html
      <div class="field"><label>Note for the group</label>
        <input type="text" value="${esc(
          p.note
        )}" placeholder="Boards on roof" onchange="saveMe({note:this.value.trim()})"></div>
```

Replace with:

```html
      <div class="field"><label>Note for the group</label>
        <input type="text" value="${esc(
          p.note
        )}" placeholder="Bringing a cooler" onchange="saveMe({note:this.value.trim()})"></div>
```

- [ ] **Step 3: Tighten the manual-add-passenger location placeholder**

In `carCard()`, find:

```html
        <input type="text" id="mp-loc" placeholder="Suburb" style="flex:1; min-width:0;">
```

Replace with:

```html
        <input type="text" id="mp-loc" placeholder="Address" style="flex:1; min-width:0;">
```

- [ ] **Step 4: Add the share-link explanatory text next to "Copy link" in the event header**

In `renderEvent()`, find:

```html
      <div class="row">
        <code id="share-code">#${esc(evId)}</code>
        <button class="small" onclick="copyShare(this)">Copy link</button>
        <button class="small" onclick="backToLanding()">New trip</button>
      </div>
    </div>
```

Replace with:

```html
      <div>
        <div class="row">
          <code id="share-code">#${esc(evId)}</code>
          <button class="small" onclick="copyShare(this)">Copy link</button>
          <button class="small" onclick="backToLanding()">New trip</button>
        </div>
        <p class="tiny" style="margin:4px 0 0; text-align:right;">Anyone with this link can view and join — nothing private is shared.</p>
      </div>
    </div>
```

- [ ] **Step 5: Verify by running the server and grepping the rendered output**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
(deno run --allow-net --allow-env server.ts > /tmp/t1.log 2>&1 &)
sleep 1.5
curl -s http://localhost:8000/ | grep -c "Weekend trip"
curl -s http://localhost:8000/ | grep -c "Blue Mountains"
curl -s http://localhost:8000/ | grep -c "Bringing a cooler"
curl -s http://localhost:8000/ | grep -c "Full street address"
curl -s http://localhost:8000/ | grep -c "nothing private is shared"
pkill -f "deno run --allow-net --allow-env server.ts"
```

Expected: each `grep -c` prints `1` (the landing page markup, including `c-name`/`c-dest` placeholders and the "Create a trip" copy, is present in the initial HTML served — the app boots into `view = "landing"` before any JS runs, but the template literal for `renderLanding()`/`renderEvent()` only executes client-side. Since this is a client-rendered app, `curl` alone won't see post-render output — see note below).

**Note:** Because rendering happens client-side (`app.innerHTML = ...` runs in the browser, not on the server), `curl`ing `/` only returns the static shell (`<div id="app"></div>` plus the `<script>` source). To verify the actual rendered strings, grep the **script source** for the literal placeholder text instead — this confirms the edit landed correctly in the file that gets shipped to the browser:

```bash
grep -c "Weekend trip" index.html
grep -c "Blue Mountains" index.html
grep -c "Bringing a cooler" index.html
grep -c "Full street address" index.html
grep -c "nothing private is shared" index.html
grep -c "Torquay" index.html   # expect 0 — old placeholders fully removed
```

Expected: first five commands each print `1`; the last prints `0`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Polish placeholder copy and add share-link explanation"
```

---

### Task 2: Remove the "Leave this car" button from the personal status panel

The button moves to the car card in Task 4. This task only removes it from `detailsPanel()`; `leaveCar()` itself is untouched (Task 4 wires a new caller to it).

**Files:**
- Modify: `index.html` (`detailsPanel()`)

**Interfaces:**
- Consumes: existing `leaveCar()` function (defined at the `async function leaveCar()` block below `detailsPanel()`) — untouched, still exists, just not called from here anymore.

- [ ] **Step 1: Remove the button, keep the informational line**

Find:

```html
      ${
        p.carOf && ev.people[p.carOf]
          ? `<div class="field">
        <p class="muted" style="margin:0 0 6px;">You're in ${esc(
          ev.people[p.carOf].name
        )}'s car.</p>
        <button class="small danger" onclick="leaveCar()">Leave this car</button></div>`
          : ""
      }
```

Replace with:

```html
      ${
        p.carOf && ev.people[p.carOf]
          ? `<div class="field">
        <p class="muted" style="margin:0 0 6px;">You're in ${esc(
          ev.people[p.carOf].name
        )}'s car.</p></div>`
          : ""
      }
```

- [ ] **Step 2: Verify the button is gone from the source but the function survives**

```bash
grep -c 'onclick="leaveCar()"' index.html
grep -c "async function leaveCar" index.html
```

Expected: first prints `0` (no callers left yet — Task 4 adds the new one), second prints `1` (function still defined).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Remove leave-car button from personal status panel"
```

---

### Task 3: Add the `mapLink()` helper

A shared helper to avoid repeating the Google Maps search URL construction in five call sites (Task 4).

**Files:**
- Modify: `index.html` (helpers section, near `function esc(s)`)

**Interfaces:**
- Produces: `function mapLink(text)` → returns `""` if `text` is falsy/empty; otherwise returns an `<a href="https://www.google.com/maps/search/?api=1&query=<encoded text>" target="_blank" rel="noopener">` tag wrapping the **escaped** text. Callers get back a ready-to-embed HTML string, never raw unescaped text — `esc()` is applied internally.

- [ ] **Step 1: Add the helper next to the other small helpers**

Find:

```js
      function esc(s) { return String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
```

If the file has since been reformatted by `deno fmt` this may instead read (multi-line, 2-space):

```js
      function esc(s) {
        return String(s == null ? "" : s).replace(
          /[&<>"']/g,
          (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
        );
      }
```

Either way, add immediately after the `esc` function (before `function hash(s)`):

```js
      function mapLink(text) {
        if (!text) return "";
        return `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          text,
        )}" target="_blank" rel="noopener">${esc(text)}</a>`;
      }
```

- [ ] **Step 2: Verify with an isolated Deno script (pure function, no DOM needed)**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
sed -n '/function esc(/,/^      }/p' index.html > /tmp/esc.js
sed -n '/function mapLink(/,/^      }/p' index.html > /tmp/maplink.js
cat /tmp/esc.js /tmp/maplink.js > /tmp/maplink_test.js
deno eval "
$(cat /tmp/maplink_test.js)
console.log(mapLink('123 Main St'));
console.log(JSON.stringify(mapLink('')));
console.log(JSON.stringify(mapLink(null)));
console.log(mapLink('<script>bad</script>'));
"
rm -f /tmp/esc.js /tmp/maplink.js /tmp/maplink_test.js
```

Expected:
- Line 1: `<a href="https://www.google.com/maps/search/?api=1&query=123%20Main%20St" target="_blank" rel="noopener">123 Main St</a>`
- Line 2: `""`
- Line 3: `""`
- Line 4: the `<script>` text is HTML-escaped inside the `<a>` (`&lt;script&gt;bad&lt;/script&gt;`), proving `esc()` is applied and this isn't an XSS hole given `s.loc`/`ev.dest`/etc. are user-entered.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add mapLink helper for clickable map locations"
```

---

### Task 4: Rewrite `carCard()` — notes visibility, map links, join/leave, invite, remove

This is the core task. It touches `stopInfo()` and `carCard()` together since they're tightly coupled (`stopInfo()`'s return value is what `carCard()`'s `stopRows` renders), and adds two new functions (`removeFromCar`, `inviteFromPool`) used by the new buttons.

**Files:**
- Modify: `index.html` (`stopInfo()`, `carCard()`; add `removeFromCar()`, `inviteFromPool()` near the other car-mutation functions like `claimSeat()`)

**Interfaces:**
- Consumes: `mapLink(text)` from Task 3; existing `mutate(fn)`, `pool()`, `occupantsOf(dk)`, `carStats(dk)`, `orderedStops(dk)`, `claimSeat(dk)`, `leaveCar()`, `me`, `ev`, `esc()`.
- Produces:
  - `stopInfo(dk, id)` now returns `{name, loc, manual, note}` (added `note`) instead of `{name, loc, manual}`.
  - `function removeFromCar(dk, id)` — driver-only action, no return value, calls `mutate()` internally. `id` follows the existing `"p:<personKey>"` / `"m:<manualPaxId>"` convention used throughout `orderedStops`/`stopInfo`.
  - `function inviteFromPool(dk, key)` — driver-only action, no return value, calls `mutate()` internally. `key` is a person key from `pool()`.
  - `addingInviteFor` — new top-level state variable (same pattern as `addingPaxFor`), holds the driver key currently showing the invite-from-pool picker, or `null`.

- [ ] **Step 1: Add `note` to `stopInfo()`'s return value**

Find:

```js
      function stopInfo(dk, id) {
        if (id.startsWith("p:")) {
          const p = ev.people[id.slice(2)];
          return p ? { name: p.name, loc: p.loc, manual: false } : null;
        }
        const key = id.slice(2);
        const m = (ev.people[dk].manualPax || []).find(
          (mm, i) => (mm.id || "i" + i) === key
        );
        return m ? { name: m.n, loc: m.loc, manual: true } : null;
      }
```

Replace with:

```js
      function stopInfo(dk, id) {
        if (id.startsWith("p:")) {
          const p = ev.people[id.slice(2)];
          return p ? { name: p.name, loc: p.loc, manual: false, note: p.note } : null;
        }
        const key = id.slice(2);
        const m = (ev.people[dk].manualPax || []).find(
          (mm, i) => (mm.id || "i" + i) === key
        );
        return m ? { name: m.n, loc: m.loc, manual: true, note: null } : null;
      }
```

- [ ] **Step 2: Add the new state variable next to the existing ones**

Find:

```js
      let addingPaxFor = null;
```

Replace with:

```js
      let addingPaxFor = null;
      let addingInviteFor = null;
```

- [ ] **Step 3: Add `removeFromCar()` and `inviteFromPool()` next to `claimSeat()`**

Find:

```js
      async function claimSeat(dk) {
        await mutate((e) => {
          const p = e.people[me];
          const s = carStatsIn(e, dk);
          if (p && p.role !== "drive" && !p.carOf && s.used < s.cap) {
            p.carOf = dk;
          }
        });
      }
```

Replace with (adding the two new functions immediately after):

```js
      async function claimSeat(dk) {
        await mutate((e) => {
          const p = e.people[me];
          const s = carStatsIn(e, dk);
          if (p && p.role !== "drive" && !p.carOf && s.used < s.cap) {
            p.carOf = dk;
          }
        });
      }

      async function removeFromCar(dk, id) {
        await mutate((e) => {
          const d = e.people[dk];
          if (id.startsWith("p:")) {
            const p = e.people[id.slice(2)];
            if (p && p.carOf === dk) p.carOf = null;
          } else {
            const key = id.slice(2);
            d.manualPax = (d.manualPax || []).filter(
              (m, i) => (m.id || "i" + i) !== key
            );
          }
          d.paxOrder = (d.paxOrder || []).filter((x) => x !== id);
        });
      }

      async function inviteFromPool(dk, key) {
        addingInviteFor = null;
        await mutate((e) => {
          const p = e.people[key];
          const s = carStatsIn(e, dk);
          if (p && p.role !== "drive" && !p.carOf && s.used < s.cap) {
            p.carOf = dk;
          }
        });
      }
```

- [ ] **Step 4: Rewrite `carCard()` in full**

Find the entire current `carCard()` function (from `function carCard(dk, i) {` through its closing `}` right before `function seatLayout(count) {`) and replace it with:

```js
      function carCard(dk, i) {
        const d = ev.people[dk];
        const ramp = RAMPS[i % RAMPS.length];
        const stats = carStats(dk);
        const mine = me === dk;
        const occupant = !mine && me && ev.people[me].carOf === dk;
        const canJoin =
          !mine &&
          !occupant &&
          me &&
          ev.people[me].role !== "drive" &&
          !ev.people[me].carOf &&
          stats.used < stats.cap;
        const stops = orderedStops(dk);
        const stopRows = stops
          .map((id, idx) => {
            const s = stopInfo(dk, id);
            if (!s) return "";
            const controls = mine
              ? `<span style="margin-left:auto; white-space:nowrap;">
        ${
          idx > 0
            ? `<button class="small" style="padding:0 6px;" onclick="moveStop('${dk}','${id}',-1)" aria-label="Earlier">&uarr;</button>`
            : ""
        }
        ${
          idx < stops.length - 1
            ? `<button class="small" style="padding:0 6px;" onclick="moveStop('${dk}','${id}',1)" aria-label="Later">&darr;</button>`
            : ""
        }
        <button class="small danger" style="padding:0 6px;" onclick="removeFromCar('${dk}','${id}')" aria-label="Remove">&times;</button>
      </span>`
              : "";
            return `<div class="stop"><span class="stopnum" style="background:${
              ramp.l
            }; color:${ramp.d};">${idx + 1}</span>
      <span>${esc(s.name)}${s.loc ? ` — ${mapLink(s.loc)}` : ""}${
              s.manual
                ? ` <span style="color:var(--amber-m);">(added by ${esc(
                    d.name
                  )})</span>`
                : ""
            }${
              s.note
                ? ` <span class="muted" style="font-style:italic;">&middot; "${esc(
                    s.note
                  )}"</span>`
                : ""
            }</span>${controls}</div>`;
          })
          .join("");
        const mapsStops = [
          d.loc,
          ...stops
            .map((id) => {
              const s = stopInfo(dk, id);
              return s && s.loc;
            })
            .filter(Boolean),
          ev.dest,
        ].filter(Boolean);
        const mapsUrl =
          "https://www.google.com/maps/dir/" +
          mapsStops.map(encodeURIComponent).join("/");
        let addForm = "";
        if (addingPaxFor === dk && mine) {
          addForm = `<div style="margin-top:8px; padding:8px; background:var(--bg); border-radius:var(--radius);">
      <div class="row" style="margin-bottom:6px;">
        <input type="text" id="mp-name" placeholder="Name" style="flex:1; min-width:0;">
        <input type="text" id="mp-loc" placeholder="Address" style="flex:1; min-width:0;">
      </div>
      <div class="row">
        <button class="small primary" onclick="addManualPax('${dk}')">Add</button>
        <button class="small" onclick="addingPaxFor=null; render();">Cancel</button>
      </div>
      <p class="tiny" style="margin:6px 0 0;">For someone with plans who won't sign up here.</p>
    </div>`;
        }
        let inviteForm = "";
        if (addingInviteFor === dk && mine) {
          const candidates = pool();
          inviteForm = `<div style="margin-top:8px; padding:8px; background:var(--bg); border-radius:var(--radius);">
      ${
        candidates.length
          ? candidates
              .map(
                (k) => `<div class="row" style="margin-bottom:4px;">
        <span style="flex:1; min-width:0;">${esc(ev.people[k].name)}</span>
        <button class="small primary" onclick="inviteFromPool('${dk}','${k}')">Invite</button>
      </div>`
              )
              .join("")
          : `<p class="tiny" style="margin:0;">Nobody left in the pool to invite.</p>`
      }
      <button class="small" onclick="addingInviteFor=null; render();">Close</button>
    </div>`;
        }
        const joinLeave = occupant
          ? `<button class="small danger" style="flex:1;" onclick="leaveCar()">Leave this car</button>`
          : canJoin
          ? `<button class="small primary" style="flex:1;" onclick="claimSeat('${dk}')">Join this car</button>`
          : "";
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
    <div style="display:flex; gap:12px; align-items:flex-start; margin-top:6px;">
      <div style="flex-shrink:0;">${carSVG(dk, ramp)}</div>
      <div style="flex:1; min-width:0;">
        <p class="tiny" style="margin:0 0 4px;">Pickup order${
          mine ? " — use arrows to reorder" : ""
        }</p>
        <div class="stop"><span class="stopnum" style="background:${
          ramp.c
        }; color:#fff;">S</span><span>${esc(d.name)} — ${
          d.loc ? mapLink(d.loc) : "TBC"
        } (start)</span></div>
        ${stopRows}
        ${
          ev.dest
            ? `<div class="stop"><span class="stopnum" style="background:${
                ramp.c
              }; color:#fff;">&#9873;</span><span style="color:var(--text);">${mapLink(
                ev.dest
              )}</span></div>`
            : ""
        }
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
      }
```

Notes on this rewrite, for the reviewer:
- `stats.cap + 1` in the header (driver + passengers) is unchanged from the original.
- `mapLink()` already escapes its input (Task 3), so the driver/destination lines are no longer double-escaped or unescaped — `esc(d.loc...)` calls are replaced by `mapLink(d.loc)`, not wrapped in an extra `esc()`.
- `d.loc ? mapLink(d.loc) : "start TBC"` / `... : "TBC"` preserves the original fallback text exactly, just gated on `d.loc` truthiness instead of relying on `||` (since `mapLink("")` also returns `""`, `||` would have worked too, but the explicit ternary is clearer about intent here).
- The pool-invite list purposefully has no cap/filter beyond `pool()` itself — if the car is full, `inviteFromPool` silently no-ops (mirrors `claimSeat`'s existing silent-no-op-when-full behavior), so no additional capacity check is needed in the button list, but keeping the list simple is intentional per YAGNI (a disabled state could be added later if this proves confusing in practice).

- [ ] **Step 5: Verify with an isolated Deno script exercising `removeFromCar` and `inviteFromPool` logic**

These two functions call `mutate(fn)`, which in the real app also calls `render()` and `persist()`. For an isolated test, extract just the inner mutator logic (the part inside `mutate((e) => { ... })`) against a plain fake event object — this mirrors the extraction-testing approach already used for `stGet`/`stSet` earlier in this project.

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno eval '
function carStatsIn(e, dk) {
  const d = e.people[dk];
  const occ = Object.keys(e.people).filter((k) => k !== dk && e.people[k].carOf === dk);
  const manual = d.manualPax || [];
  const cap = Math.max(1, parseInt(d.seats || 0, 10) || 0);
  return { cap, used: occ.length + manual.length };
}

function removeFromCarLogic(e, dk, id) {
  const d = e.people[dk];
  if (id.startsWith("p:")) {
    const p = e.people[id.slice(2)];
    if (p && p.carOf === dk) p.carOf = null;
  } else {
    const key = id.slice(2);
    d.manualPax = (d.manualPax || []).filter((m, i) => (m.id || "i" + i) !== key);
  }
  d.paxOrder = (d.paxOrder || []).filter((x) => x !== id);
}

function inviteFromPoolLogic(e, dk, key) {
  const p = e.people[key];
  const s = carStatsIn(e, dk);
  if (p && p.role !== "drive" && !p.carOf && s.used < s.cap) {
    p.carOf = dk;
  }
}

// removeFromCar: real passenger
let e = { people: {
  driver1: { seats: 2, manualPax: [], paxOrder: ["p:alice"] },
  alice: { role: "ride", carOf: "driver1" },
} };
removeFromCarLogic(e, "driver1", "p:alice");
console.log("remove real passenger -> carOf:", e.people.alice.carOf, "(expect null)");
console.log("paxOrder after remove:", JSON.stringify(e.people.driver1.paxOrder), "(expect [])");

// removeFromCar: manual/phantom passenger
e = { people: {
  driver1: { seats: 2, manualPax: [{ id: "m1", n: "Bob" }], paxOrder: ["m:m1"] },
} };
removeFromCarLogic(e, "driver1", "m:m1");
console.log("remove manual passenger -> manualPax:", JSON.stringify(e.people.driver1.manualPax), "(expect [])");

// inviteFromPool: happy path
e = { people: {
  driver1: { seats: 2, manualPax: [] },
  carol: { role: "ride", carOf: null },
} };
inviteFromPoolLogic(e, "driver1", "carol");
console.log("invite -> carOf:", e.people.carol.carOf, "(expect driver1)");

// inviteFromPool: car already full -> no-op
e = { people: {
  driver1: { seats: 1, manualPax: [] },
  dave: { role: "ride", carOf: "driver1" },
  erin: { role: "ride", carOf: null },
} };
inviteFromPoolLogic(e, "driver1", "erin");
console.log("invite when full -> carOf:", e.people.erin.carOf, "(expect null, car has 1/1 seats used)");
'
```

Expected output:
```
remove real passenger -> carOf: null (expect null)
paxOrder after remove: [] (expect [])
remove manual passenger -> manualPax: [] (expect [])
invite -> carOf: driver1 (expect driver1)
invite when full -> carOf: null (expect null, car has 1/1 seats used)
```

If any line doesn't match, the logic in `removeFromCar`/`inviteFromPool` (Step 3) diverges from this trace — fix the function in `index.html`, not the test.

- [ ] **Step 6: Typecheck and smoke-test the running server**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t4.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t4.log
```

Expected: `deno check` reports only the pre-existing unrelated `err.message` TS18046 error (not a new one introduced by this task); `curl` prints `200`; the log shows `Listening on http://0.0.0.0:8000/` with no runtime errors.

- [ ] **Step 7: Manual browser check (this task changes interactive behavior that a curl/grep check can't fully cover)**

Run `deno task start`, open `http://localhost:8000/` in a browser, create a trip, and as the creator:
- Set role to "I can drive", confirm the car card now shows "+ Add passenger" and "+ Invite from pool" buttons, and no "Open in Google Maps" button crash.
- Open a second browser (or incognito) window, sign in with a different name on the same trip, set role to "I need a ride" — confirm a "Join this car" button appears on the driver's car card, and clicking it moves you into the car and the button becomes "Leave this car" on reload.
- As the driver, click "+ Invite from pool" with someone still in the pool, invite them, confirm they appear as a stop with a working map link and (if they set a note) the note is visible.
- Click the `×` next to a stop, confirm that person/entry is removed and returns to the pool (for a real passenger) or disappears entirely (for a manual passenger).
- Click a stop's location text, confirm it opens Google Maps in a new tab for that address.

This step has no automated pass/fail — note in the plan-execution log which of these five behaviors were confirmed working.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "Rewrite car card: notes visibility, map links, join/leave, invite, remove"
```

---

### Task 5: Make the trip destination in the event header clickable

**Files:**
- Modify: `index.html` (`renderEvent()`)

**Interfaces:**
- Consumes: `mapLink(text)` from Task 3.

- [ ] **Step 1: Replace the destination text in the topbar with `mapLink()`**

Find:

```js
        <p class="muted" style="margin:4px 0 0;">${esc(ev.date || "date TBC")}${
          ev.dest ? ` &middot; to ${esc(ev.dest)}` : ""
        }${
```

Replace with:

```js
        <p class="muted" style="margin:4px 0 0;">${esc(ev.date || "date TBC")}${
          ev.dest ? ` &middot; to ${mapLink(ev.dest)}` : ""
        }${
```

- [ ] **Step 2: Verify**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
grep -n '&middot; to \${mapLink(ev.dest)}' index.html
deno check server.ts
```

Expected: the `grep` finds the line (confirms the edit landed); `deno check` still shows only the pre-existing unrelated error.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Make trip destination in event header a clickable map link"
```

---

## Final Verification (after all tasks)

- [ ] Run `deno check server.ts` — only the pre-existing `err.message` TS18046 error should remain.
- [ ] Run the server (`deno task start`), and in a browser walk through: create a trip, sign in, set location and note, pick "I can drive", add a manual passenger and remove them, invite someone from the pool, have a second browser/session join and leave a car, and click every map link (stop rows, start row, destination row, header destination) to confirm each opens the correct Google Maps search.
- [ ] Confirm `git log --oneline -6` shows the five task commits plus nothing unexpected.
