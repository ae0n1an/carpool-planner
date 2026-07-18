# Simplified Identity & Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `docs/superpowers/specs/2026-07-19-simplified-identity-editing-design.md`: a single "You" panel for identity/location/note editing, a fully read-only `poolRow()`, click-to-edit-at-the-display controls on the car card (seats, leaving-at), and full removal of the `flex`/`meet` fields.

**Architecture:** All changes live in `index.html`'s single `<script>` block. Tasks are ordered so each commit leaves the app fully working: Task 1 adds the new "You" panel (replacing nothing yet — it fills a slot that previously rendered nothing when signed in); Tasks 2-3 then remove the editing capability that's now redundant with the You panel; Task 4 is small cleanup (removing `flex`/`meet` remnants and the add-car location field) that depends on Task 1 existing.

**Tech Stack:** Vanilla JS, no build step, no test framework — same as prior work in this repo.

## Global Constraints

- No new files, no external dependencies.
- No change to `geoLocate()`'s reverse-geocoding logic — only a new call site passing `'you-loc'`.
- No change to `setSeats(inp)`/`confirmSeatChange()`'s existing confirm-before-shrink logic — Task 3 only changes how the input is *shown* (click-to-reveal instead of always-visible), not what it does.
- No change to `removeCar()`/`confirmRemoveCar()`/`cancelRemoveCar()`, `claimSeat()`, `removeFromCar()`, `inviteFromPool()`, `addManualPax()`, manual-match claim flow, map links, or the seat SVG.
- This project has no test framework. Verification is one-off Deno extraction scripts for pure logic/rendering (the established technique in this project) and grep/typecheck/smoke-test checks.
- Preserve existing code style: 2-space indentation, double quotes (deno fmt style).
- **Click-to-edit ordering rule** (applies to every new inline-edit control in this plan): when a save handler both closes edit mode and persists a value, set the edit-mode flag to `false` **before** calling `saveMe()`/`mutate()` — those functions call `render()` internally, so the flag must already reflect the new state when that internal render happens, or the UI will show stale (still-editing) markup until the next unrelated render.

---

### Task 1: The "You" panel

**Files:**
- Modify: `index.html` (new `youPanel()` function; new `editingMyLoc`/`editingMyNote` state variables; `renderEvent()`'s top-panel slot)

**Interfaces:**
- Consumes: `esc()`, `initials()`, `mapLink()` (not used here, but the display-mode text mirrors the plain-text pattern), `saveMe(patch)`, `signOut()` (unchanged), `geoLocate(btn, inputId)`.
- Produces: `function youPanel()` → returns a card for the signed-in viewer (`ev.people[me]`) with click-to-edit location and note fields. `let editingMyLoc = false;` / `let editingMyNote = false;` — new top-level state variables.

- [ ] **Step 1: Add the two new state variables**

Find:

```js
      let pendingRemoveCar = false;
```

Replace with:

```js
      let pendingRemoveCar = false;
      let editingMyLoc = false;
      let editingMyNote = false;
```

- [ ] **Step 2: Add `youPanel()` right after `signInPanel()`**

Find:

```js
      /* ---------- sign in ---------- */
      function signInPanel() {
        return `<div class="card">
    <h2 style="margin-bottom:12px;">Sign in</h2>
    <div class="field"><label>Your name</label><input type="text" id="si-name"></div>
    <div class="field"><label>Password (optional)</label><input type="password" id="si-pw"></div>
    <p class="tiny" id="si-err" style="color:var(--red); margin:0 0 8px; display:none;"></p>
    <button class="primary" style="width:100%;" onclick="signIn()">Sign in</button>
    <p class="tiny" style="margin:10px 0 0; line-height:1.6;">Name and password are only for this trip.<br>New here? Just pick a name.<br>Returning? Use the same name and password.</p>
  </div>`;
      }
```

Replace with (adding `youPanel()` immediately after):

```js
      /* ---------- sign in ---------- */
      function signInPanel() {
        return `<div class="card">
    <h2 style="margin-bottom:12px;">Sign in</h2>
    <div class="field"><label>Your name</label><input type="text" id="si-name"></div>
    <div class="field"><label>Password (optional)</label><input type="password" id="si-pw"></div>
    <p class="tiny" id="si-err" style="color:var(--red); margin:0 0 8px; display:none;"></p>
    <button class="primary" style="width:100%;" onclick="signIn()">Sign in</button>
    <p class="tiny" style="margin:10px 0 0; line-height:1.6;">Name and password are only for this trip.<br>New here? Just pick a name.<br>Returning? Use the same name and password.</p>
  </div>`;
      }

      function youPanel() {
        const p = ev.people[me];
        return `<div class="card">
    <div class="row" style="justify-content:space-between;">
      <div class="row">
        <div class="avatar" style="background:var(--blue-l); color:var(--blue-d);">${initials(
          p.name
        )}</div>
        <span style="font-weight:600; font-size:14px;">${esc(p.name)}</span>
      </div>
      <button class="small" onclick="signOut()">Sign out</button>
    </div>
    <div class="field" style="margin-top:12px;">
      <label>Pickup / departing from</label>
      ${
        editingMyLoc
          ? `<div class="row">
        <input type="text" id="you-loc" value="${esc(
          p.loc
        )}" placeholder="Full street address" style="flex:1; min-width:0;" onchange="editingMyLoc=false; saveMe({loc:this.value.trim()});">
        <button class="small" onclick="geoLocate(this,'you-loc')" title="Use my current location">Locate me</button>
      </div>`
          : `<p class="muted" style="margin:0; cursor:pointer;" onclick="editingMyLoc=true; render();">${
              p.loc ? esc(p.loc) : "Tap to add"
            } &middot; <span style="color:var(--blue-m);">edit</span></p>`
      }
    </div>
    <div class="field" style="margin-top:8px;">
      <label>Note for the group</label>
      ${
        editingMyNote
          ? `<input type="text" id="you-note" value="${esc(
              p.note
            )}" placeholder="Bringing a cooler" style="width:100%;" onchange="editingMyNote=false; saveMe({note:this.value.trim()});">`
          : `<p class="muted" style="margin:0; cursor:pointer;" onclick="editingMyNote=true; render();">${
              p.note ? esc(p.note) : "Tap to add"
            } &middot; <span style="color:var(--blue-m);">edit</span></p>`
      }
    </div>
  </div>`;
      }
```

- [ ] **Step 3: Wire `youPanel()` into `renderEvent()`'s top slot**

Find:

```html
    <div class="grid" style="grid-template-columns:1fr;">
      ${
        me
          ? ""
          : `<div style="max-width:420px; margin:0 auto 14px;">${signInPanel()}</div>`
      }
      <div>
```

Replace with:

```html
    <div class="grid" style="grid-template-columns:1fr;">
      <div style="max-width:420px; margin:0 auto 14px;">${
        me ? youPanel() : signInPanel()
      }</div>
      <div>
```

- [ ] **Step 4: Verify with an isolated Deno script**

Extract `youPanel()` and its dependencies (`esc`, `initials`) into a script and assert on display-mode vs. edit-mode output for both fields:

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
sed -n '/^      function esc(/,/^      }/p' index.html > /tmp/you_deps.js
sed -n '/^      function initials(/,/^      }/p' index.html >> /tmp/you_deps.js
sed -n '/^      function youPanel(/,/^      }/p' index.html >> /tmp/you_deps.js
deno eval "
let me = 'alice';
let ev = { people: { alice: { name: 'Alice', loc: '1 Test St', note: 'Bringing snacks' } } };
let editingMyLoc = false;
let editingMyNote = false;
function signOut(){}
function saveMe(){}
function render(){}
function geoLocate(){}
$(cat /tmp/you_deps.js)
const displayMode = youPanel();
console.log('display mode shows loc text:', displayMode.includes('1 Test St'));
console.log('display mode shows note text:', displayMode.includes('Bringing snacks'));
console.log('display mode has no inputs:', !displayMode.includes('<input'));
editingMyLoc = true;
const editLocMode = youPanel();
console.log('edit-loc mode has you-loc input:', editLocMode.includes('id=\"you-loc\"'));
editingMyLoc = false;
editingMyNote = true;
const editNoteMode = youPanel();
console.log('edit-note mode has you-note input:', editNoteMode.includes('id=\"you-note\"'));
"
rm -f /tmp/you_deps.js
```

Expected: all five lines print `true`.

- [ ] **Step 5: Typecheck and smoke-test**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t1.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t1.log
```

Expected: typecheck shows only the pre-existing unrelated `err.message` TS18046 error; curl prints `200`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add the You panel for identity/location/note editing"
```

---

### Task 2: `poolRow()` — always read-only, drop flex/meet

**Files:**
- Modify: `index.html` (`poolRow()`)

**Interfaces:**
- Consumes: `esc()`, `mapLink()`, `initials()`.
- Produces: `poolRow(k)`'s signature and call site (`pool().map(poolRow)`, unchanged, outside this diff) continue to work exactly as before.

- [ ] **Step 1: Replace `poolRow()` in full**

Find:

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

Replace with:

```js
      function poolRow(k) {
        const p = ev.people[k];
        return `<div class="pool-row">
    <div class="avatar" style="background:var(--blue-l); color:var(--blue-d);">${initials(
          p.name
        )}</div>
    <div style="flex:1; min-width:0;">
      <div style="font-size:13px; font-weight:600;">${esc(p.name)}</div>
      <div class="muted">${p.loc ? mapLink(p.loc) : "location TBC"}${
          p.note ? ` &middot; <i>"${esc(p.note)}"</i>` : ""
        }</div>
    </div>
  </div>`;
      }
```

- [ ] **Step 2: Verify with an isolated Deno script**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
sed -n '/^      function esc(/,/^      }/p' index.html > /tmp/poolrow_deps.js
sed -n '/^      function initials(/,/^      }/p' index.html >> /tmp/poolrow_deps.js
sed -n '/^      function mapLink(/,/^      }/p' index.html >> /tmp/poolrow_deps.js
sed -n '/^      function poolRow(/,/^      }/p' index.html >> /tmp/poolrow_deps.js
deno eval "
let me = 'alice';
let ev = { people: {
  alice: { name: 'Alice', loc: '1 Test St', note: '' },
} };
$(cat /tmp/poolrow_deps.js)
const mine = poolRow('alice');
console.log('no input tags:', !mine.includes('<input'));
console.log('no checkbox/flex/meet text:', !mine.includes('checkbox') && !mine.includes('Could drive') && !mine.includes('meet anywhere'));
console.log('has map link:', mine.includes('<a href='));
console.log('no sign out button (moved to You panel):', !mine.includes('signOut()'));
"
rm -f /tmp/poolrow_deps.js
```

Expected: all four lines print `true`.

- [ ] **Step 3: Typecheck and smoke-test**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t2.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t2.log
```

Expected: typecheck shows only the pre-existing unrelated error; curl prints `200`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Make pool rows always read-only; drop flex/meet display"
```

---

### Task 3: Car card — seats/leaving-at inline, remove Edit car details

**Files:**
- Modify: `index.html` (`carCard()`; delete `saveCarDetails()`; delete `editingCarFor` state variable; new `editingSeats` state variable)

**Interfaces:**
- Consumes: `setSeats(inp)` (unchanged, existing — including its `pendingSeatChange` confirm flow), `saveMe(patch)`, `mapLink()`, `esc()`.
- Produces: `let editingSeats = false;` — new top-level state variable (plain boolean, not keyed by `dk`, matching `addingCar`'s pattern — there's only ever one "my seats" edit in progress).

- [ ] **Step 1: Replace the `editingCarFor` state variable with `editingSeats`**

Find:

```js
      let editingCarFor = null;
      let pendingRemoveCar = false;
```

Replace with:

```js
      let editingSeats = false;
      let pendingRemoveCar = false;
```

(Note: this removes `editingCarFor` — Step 3 below removes the code that used it.)

- [ ] **Step 2: Delete `saveCarDetails()`**

Find:

```js
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

Replace with:

```js
      function geoLocate(btn, inputId) {
```

- [ ] **Step 3: Rewrite the header/seats section and remove `carDetailsForm`**

Find (from the `carDetailsForm` construction through the return statement's header row):

```js
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
```

Replace with:

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
          mine
            ? ` &middot; <input type="time" value="${esc(
                d.leaveAt
              )}" style="width:auto; display:inline-block; padding:2px 4px; font-size:12px;" onchange="saveMe({leaveAt:this.value})">`
            : d.leaveAt
            ? ` &middot; departs <b style="color:var(--text);">${esc(
                d.leaveAt
              )}</b>`
            : " &middot; time TBC"
        }</p>
      </div>
      ${
        mine
          ? editingSeats
            ? `<input type="number" min="1" max="12" value="${esc(
                d.seats
              )}" style="width:56px; padding:4px 6px;" onchange="editingSeats=false; setSeats(this);" aria-label="Passenger seats">`
            : `<span class="badge" style="background:${ramp.l}; color:${ramp.d}; cursor:pointer;" onclick="editingSeats=true; render();" title="Edit seats">${
                stats.used
              }/${stats.cap}</span>`
          : `<span class="badge" style="background:${ramp.l}; color:${ramp.d};">${
              stats.used
            }/${stats.cap}</span>`
      }
    </div>
```

Note this deletes the `carDetailsForm` variable entirely — it's no longer referenced anywhere (Step 4 removes its one render call site).

- [ ] **Step 4: Remove the "Edit car details" button and the `${carDetailsForm}` render call**

Find:

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
```

Replace with:

```js
        ${
          mine
            ? `<div class="row" style="margin-top:6px; flex-wrap:wrap;">
          <button class="small" onclick="addingPaxFor='${dk}'; render();">+ Add passenger</button>
          <button class="small" onclick="addingInviteFor='${dk}'; render();">+ Invite from pool</button>
          <button class="small danger" onclick="removeCar()">Remove my car</button>
        </div>`
            : ""
        }
        ${addForm}
        ${inviteForm}
      </div>
    </div>
```

- [ ] **Step 5: Verify with an isolated Deno rendering-extraction script**

Following the technique already used earlier in this project for `carCard()`: extract `carCard`, `stopInfo`, `mapLink`, `esc`, stub `carSVG`, build fake `ev`/`me` state, and assert:

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
python3 - <<'PYEOF'
import re
src = open("index.html").read()
def extract(name):
    m = re.search(r"function %s\(.*?\n      \}\n" % name, src, re.S)
    return m.group(0)
funcs = "\n".join(extract(n) for n in ["esc", "mapLink", "initials"])
carcard_start = src.index("function carCard(dk, i) {")
carcard_end = src.index("function seatLayout(count) {")
carcard_src = src[carcard_start:carcard_end]
stopinfo_start = src.index("function stopInfo(dk, id) {")
stopinfo_end = src.index("function carCard(dk, i) {")
stopinfo_src = src[stopinfo_start:stopinfo_end]
orderedstops_start = src.index("function orderedStops(dk) {")
orderedstops_end = stopinfo_start
orderedstops_src = src[orderedstops_start:orderedstops_end]
open("/tmp/carcard_deps.js", "w").write(funcs + "\n" + orderedstops_src + stopinfo_src + carcard_src)
PYEOF
deno eval "
const RAMPS = [{c:'#000',l:'#eee',d:'#000',m:'#000'}];
function carSVG(){ return ''; }
function occupantsOf(dk){ return []; }
function carStats(dk){ return { occ: [], manual: [], cap: 4, used: 0 }; }
function orderedStopsIn(){ return []; }
let addingPaxFor = null, addingInviteFor = null, editingSeats = false, pendingSeatChange = null, pendingRemoveCar = false;
let me = 'alice';
let ev = { dest: '', people: {
  alice: { name: 'Alice', role: 'drive', seats: 4, loc: '1 Test St', leaveAt: '08:30', note: '', manualPax: [], paxOrder: [] },
} };
$(cat /tmp/carcard_deps.js)
const notEditing = carCard('alice', 0);
console.log('badge shown when not editing seats:', notEditing.includes('4/4') && notEditing.includes('cursor:pointer'));
console.log('no seats number input when not editing:', !notEditing.includes('aria-label=\"Passenger seats\"'));
console.log('leaving-at time input present (mine, always visible):', notEditing.includes('type=\"time\" value=\"08:30\"'));
console.log('no Edit car details button:', !notEditing.includes('Edit car details'));
console.log('no editingCarFor references:', !notEditing.includes('editingCarFor'));
console.log('Remove my car button present:', notEditing.includes('Remove my car'));
editingSeats = true;
const editing = carCard('alice', 0);
console.log('seats input present when editing:', editing.includes('aria-label=\"Passenger seats\"'));
"
rm -f /tmp/carcard_deps.js
```

Expected: all seven lines print `true`.

- [ ] **Step 6: Typecheck and smoke-test**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
(deno run --allow-net --allow-env server.ts > /tmp/t3.log 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/t3.log
```

Expected: typecheck shows only the pre-existing unrelated error; curl prints `200`.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Car card: click-to-edit seats, always-visible leaving-at, remove Edit car details"
```

---

### Task 4: Remove flex/meet remnants; Add-my-car drops location field

**Files:**
- Modify: `index.html` (`signIn()`, `addCar()`, `renderEvent()`'s add-car form markup and seat-shortage hint)

**Interfaces:**
- Consumes/Produces: no new interfaces. `addCar()`'s signature (`async function addCar()`, no arguments, reads DOM inputs directly) is unchanged; it now reads one fewer input.

- [ ] **Step 1: Remove `flex`/`meet` from `signIn()`'s new-person object**

Find:

```js
          ev.people[k] = {
            name,
            pw: pw ? hash(pw) : null,
            role: null,
            flex: false,
            seats: 4,
            loc: "",
            meet: false,
            note: "",
            leaveAt: "",
            carOf: null,
            manualPax: [],
            paxOrder: [],
          };
```

Replace with:

```js
          ev.people[k] = {
            name,
            pw: pw ? hash(pw) : null,
            role: null,
            seats: 4,
            loc: "",
            note: "",
            leaveAt: "",
            carOf: null,
            manualPax: [],
            paxOrder: [],
          };
```

- [ ] **Step 2: Remove the location field from the "+ Add my car" form markup**

Find:

```html
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
          <div class="field"><label>Leaving at</label>
            <input type="time" id="ac-leave"></div>
          <div class="row">
            <button class="small primary" onclick="addCar()">Add my car</button>
            <button class="small" onclick="addingCar=false; render();">Cancel</button>
          </div>
        </div>`
            : ""
        }
```

Replace with:

```html
        ${
          addingCar
            ? `<div class="card" style="margin-bottom:14px;">
          <div class="field"><label>Passenger seats (excl. you) *</label>
            <input type="number" id="ac-seats" min="1" max="12" value="4"></div>
          <div class="field"><label>Leaving at</label>
            <input type="time" id="ac-leave"></div>
          <div class="row">
            <button class="small primary" onclick="addCar()">Add my car</button>
            <button class="small" onclick="addingCar=false; render();">Cancel</button>
          </div>
        </div>`
            : ""
        }
```

- [ ] **Step 3: Simplify `addCar()`**

Find:

```js
      async function addCar() {
        const seatsInput = document.getElementById("ac-seats");
        const locInput = document.getElementById("ac-loc");
        const leaveInput = document.getElementById("ac-leave");
        const seats = Math.max(
          1,
          Math.min(12, parseInt(seatsInput.value, 10) || 1)
        );
        const loc = locInput.value.trim();
        const leaveAt = leaveInput.value;
        addingCar = false;
        await mutate((e) => {
          const p = e.people[me];
          p.role = "drive";
          p.seats = seats;
          p.loc = loc;
          p.leaveAt = leaveAt;
          p.carOf = null;
          p.flex = false;
        });
      }
```

Replace with:

```js
      async function addCar() {
        const seatsInput = document.getElementById("ac-seats");
        const leaveInput = document.getElementById("ac-leave");
        const seats = Math.max(
          1,
          Math.min(12, parseInt(seatsInput.value, 10) || 1)
        );
        const leaveAt = leaveInput.value;
        addingCar = false;
        await mutate((e) => {
          const p = e.people[me];
          p.role = "drive";
          p.seats = seats;
          p.leaveAt = leaveAt;
          p.carOf = null;
        });
      }
```

(`p.loc` is deliberately untouched here — it's already set via the You panel, on the same person record.)

- [ ] **Step 4: Drop the flex-based suggestion from the seat-shortage hint**

Find:

```js
      function renderEvent() {
        const short = seatShortage();
        const flexFolk = pool().filter((k) => ev.people[k].flex);
        let shortLine = "";
        if (drivers().length && short > 0) {
          shortLine = flexFolk.length
            ? `<span class="hint-warn">${short} seat${
                short > 1 ? "s" : ""
              } short — ${esc(ev.people[flexFolk[0]].name)} could drive</span>`
            : `<span class="hint-warn">${short} seat${
                short > 1 ? "s" : ""
              } short</span>`;
        }
```

Replace with:

```js
      function renderEvent() {
        const short = seatShortage();
        let shortLine = "";
        if (drivers().length && short > 0) {
          shortLine = `<span class="hint-warn">${short} seat${
            short > 1 ? "s" : ""
          } short</span>`;
        }
```

- [ ] **Step 5: Verify with an isolated Deno script exercising `addCar`'s mutation logic**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno eval '
function addCarLogic(e, me, seats, leaveAt) {
  const p = e.people[me];
  p.role = "drive";
  p.seats = seats;
  p.leaveAt = leaveAt;
  p.carOf = null;
}
let e = { people: { alice: { role: null, seats: 4, loc: "1 Test St", leaveAt: "", carOf: null } } };
addCarLogic(e, "alice", 3, "08:30");
console.log(JSON.stringify(e.people.alice));
console.log(
  e.people.alice.role === "drive" &&
    e.people.alice.seats === 3 &&
    e.people.alice.leaveAt === "08:30" &&
    e.people.alice.carOf === null &&
    e.people.alice.loc === "1 Test St"
    ? "PASS (loc untouched, as intended)"
    : "FAIL"
);
'
```

Expected: prints the updated object, then `PASS (loc untouched, as intended)`.

- [ ] **Step 6: Verify no dead references remain**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
grep -n "\.flex\b\|\.meet\b\|flexBadge\|meetBadge\|flexFolk\|editingCarFor\|saveCarDetails\|ecd-loc\|ecd-leave\|ecd-note\|ac-loc\|pr-loc\|Edit car details\|Could drive if needed\|Happy to meet" index.html
```

Expected: no matches.

- [ ] **Step 7: Typecheck and smoke-test**

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

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "Remove flex/meet entirely; Add-my-car reuses You-panel location"
```

---

## Final Verification (after all tasks)

- [ ] `deno check server.ts` — only the pre-existing `err.message` TS18046 error should remain.
- [ ] `grep -n "\.flex\b\|\.meet\b\|editingCarFor\|saveCarDetails\|pr-loc\|ecd-loc" index.html` — no matches.
- [ ] Manual browser walkthrough (no browser access in this environment — flag as a required human pass, same as the prior plan): sign in → You panel shows, click location/note text to edit each, confirm they save and collapse back to display text; from the pool, "+ Add my car" now only asks seats + leaving-at, and the resulting car uses your You-panel location; on your own car card, click the seat badge to edit it (confirm the existing shrink-confirmation still fires when reducing below current passengers), confirm leaving-at is directly editable inline with no separate form; confirm there's no "Edit car details" button anywhere.
- [ ] `git log --oneline -4` shows the four task commits.
