# Split Source Into Multiple Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `index.html`'s 1560 lines into `styles.css`, `state.js`, `storage.js`, `render.js`, `actions.js`, and a minimal `index.html` skeleton, per `docs/superpowers/specs/2026-07-21-split-source-files-design.md`, with `server.ts` bundling them back into one served response — zero behavior change.

**Architecture:** Task 1 produces the split files using a proven extraction script (already prototyped and verified against the current file — see Global Constraints). Task 2 wires `server.ts` to bundle them and proves the full HTTP round trip is correct against a pre-captured reference snapshot of today's `/` response.

**Tech Stack:** Vanilla JS, no build step, no test framework, Python 3 (available on this system) for the one-off extraction/verification scripts — same throwaway-script pattern already used throughout this project's history.

## Global Constraints

- No behavior change. This is a pure reorganization.
- A reference snapshot of the current `/` response already exists at `.superpowers/sdd/original-response.html` (captured and verified identical to today's `index.html` before this plan was written) — Task 2 uses it as the ground truth for end-to-end verification. Do not regenerate it; if it's missing, STOP and report NEEDS_CONTEXT rather than re-capturing it from a possibly-already-modified tree.
- **The split reorders code by concern** (e.g., all storage-related functions move together, even though today they're split across two regions of the file with unrelated code in between). This means the concatenated JS will **not** be byte-identical to today's `<script>` block — that's expected and correct, not a bug. What must be true instead: every function/variable's *own* text is relocated verbatim (zero corruption), and the CSS block (which isn't being further split, just relocated wholesale) **is** byte-identical.
- Ordering safety: JS `function` declarations are hoisted (order-independent). Top-level `let`/`const` statements only matter in the order they execute relative to each other — and since none of this app's logic runs until `boot()` is called at the very end of the fully-concatenated script, by which point every file's top-level statements have already executed, cross-file ordering is safe. The one genuine order dependency (`window.storage = {...}` must be assigned before `const hasStore = ...` reads it) is self-contained within a single file (`storage.js`) in this split, so it's preserved automatically.
- `"use strict";` (today's first line of the script) must end up at the very top of the bundled script — hardcode it onto `state.js` (first file in concatenation order), don't try to derive it generically.
- **Critical `String.replace()` gotcha:** when substituting the CSS/JS content into the `index.html` skeleton in `server.ts`, you MUST use the function form of the second argument (`.replace(placeholder, () => content)`), not a plain string. `String.replace()` treats sequences like `$&`, `` $` ``, `$1` specially in a plain-string replacement, and this codebase's JS is full of template literals (`${esc(...)}`) — a plain-string replace risks corrupting the bundled output. The function form treats the return value as a literal string with no special-pattern handling.
- Preserve existing code style: 2-space indentation, double quotes (deno fmt style) — the extraction script preserves this automatically since it moves existing text verbatim.

---

### Task 1: Split `index.html` into `styles.css`, `state.js`, `storage.js`, `render.js`, `actions.js`, and a skeleton `index.html`

**Files:**
- Create: `styles.css`, `state.js`, `storage.js`, `render.js`, `actions.js`
- Modify: `index.html` (replaced with a minimal skeleton)

**Interfaces:**
- Produces: five new files whose combined content is exactly today's `index.html` content, reorganized. No function signatures change. No new functions are introduced.

- [ ] **Step 1: Write and run the extraction script**

This script has already been prototyped and verified (chunk-by-chunk, against the current `index.html`) to correctly split the file with zero data loss or corruption. Use it exactly as given — do not modify the chunking logic or the name→file mapping.

Write this to a temporary location (e.g. `/tmp/split.py`) and run it from the repo root:

```python
import re
import os

src = open("index.html").read()
lines = src.split("\n")

style_start = next(i for i, l in enumerate(lines) if l.strip() == "<style>")
style_end = next(i for i, l in enumerate(lines) if l.strip() == "</style>")
css_lines = lines[style_start + 1:style_end]

script_start = next(i for i, l in enumerate(lines) if l.strip() == "<script>")
script_end = next(i for i, l in enumerate(lines) if l.strip() == "</script>")
js_lines = lines[script_start + 1:script_end]

# "use strict"; is a preamble before any recognized chunk-start; it must
# apply to the whole bundled script, so it's hardcoded onto state.js (the
# first file in concatenation order) rather than extracted generically.
preamble = js_lines[0]
assert preamble.strip() == '"use strict";', preamble
js_lines = js_lines[1:]

chunk_re = re.compile(r'^      (async function |function |let |const |/\*)')

FILES = ["state.js", "storage.js", "render.js", "actions.js"]
name_to_file = {}
def m(names, f):
    for n in names.split():
        name_to_file[n] = f

m("view notFound ev evId me pendingSeatChange addingPaxFor addingInviteFor "
  "addingCar editingSeats pendingRemoveCar editingMyLoc editingMyNote "
  "lastSnapshot pollTimer RAMPS esc mapLink hash uid keyOf initials", "state.js")
m("mem hasStore stGet stSet stList loadEvent saveEvent persistChain "
  "pendingWrites lastLocalEdit persist saveMe mutate", "storage.js")
m("drivers occupantsOf carStats carStatsIn pool seatShortage app render "
  "renderLanding renderEvent carsSummary shareUrl signInPanel youPanel "
  "poolRow carCard seatLayout carSVG manualMatchBanner orderedStops "
  "orderedStopsIn stopInfo manualMatches", "render.js")
m("createTrip openEvent backToLanding addCar copyShare shareEvent signIn "
  "signOut leaveCar removeCar confirmRemoveCar cancelRemoveCar claimManual "
  "dismissManual setSeats confirmSeatChange geoLocate flashBtn claimSeat "
  "removeFromCar inviteFromPool addManualPax moveStop startPolling "
  "stopPolling boot", "actions.js")

starts = [i for i, l in enumerate(js_lines) if chunk_re.match(l)]
starts.append(len(js_lines))

chunks = []
for idx in range(len(starts) - 1):
    a, b = starts[idx], starts[idx + 1]
    block = js_lines[a:b]
    first = block[0]
    if first.strip().startswith("/*"):
        chunks.append((None, None, block))
        continue
    mobj = re.match(r'^      (?:async function|function|let|const)\s+(\w+)', first)
    name = mobj.group(1) if mobj else None
    if name is None:
        raise SystemExit(f"UNRECOGNIZED CHUNK START: {first!r}")
    if name not in name_to_file:
        raise SystemExit(f"NAME NOT IN MAPPING: {name!r} (line: {first!r})")
    chunks.append((name, name_to_file[name], block))

pending_comment = []
resolved = []
for name, file, block in chunks:
    if file is None:
        pending_comment.extend(block)
        continue
    full = pending_comment + block
    pending_comment = []
    resolved.append((file, full))

if pending_comment:
    raise SystemExit(f"trailing comment with no following declaration: {pending_comment}")

out = {f: [] for f in FILES}
out["state.js"].append(preamble)
out["state.js"].append("")

for file, block in resolved:
    out[file].extend(block)
    out[file].append("")

with open("styles.css", "w") as f:
    f.write("\n".join(css_lines).strip("\n") + "\n")
for file in FILES:
    with open(file, "w") as f:
        f.write("\n".join(out[file]).strip("\n") + "\n")

names_seen = {f: [] for f in FILES}
for (name, file, block) in chunks:
    if file:
        names_seen[file].append(name)
print("Chunk counts per file:")
for file in FILES:
    print(f"  {file}: {len(names_seen[file])} declarations")
print("Total declarations:", sum(len(v) for v in names_seen.values()))
```

Run it:

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
python3 /tmp/split.py
```

Expected output:

```
Chunk counts per file:
  state.js: 22 declarations
  storage.js: 13 declarations
  render.js: 23 declarations
  actions.js: 26 declarations
Total declarations: 84
```

If the script raises `UNRECOGNIZED CHUNK START` or `NAME NOT IN MAPPING`, or the counts don't match exactly, STOP — this means `index.html` has changed since this plan was written and the mapping is stale. Report NEEDS_CONTEXT with the exact error rather than guessing at a fix to the script.

- [ ] **Step 2: Verify zero data loss or corruption with a per-chunk diff**

This compares every function/variable's text between the original `index.html` (still on disk at this point — don't touch it yet) and the newly-written files, matching by declared name rather than by position (since position legitimately changes).

Write this to `/tmp/chunk_diff.py` and run it:

```python
import re, os

original = open("index.html").read()
lines = original.split("\n")
script_start = next(i for i, l in enumerate(lines) if l.strip() == "<script>")
script_end = next(i for i, l in enumerate(lines) if l.strip() == "</script>")
js_lines = lines[script_start + 1:script_end]

chunk_re = re.compile(r'^      (async function |function |let |const |/\*)')
starts = [i for i, l in enumerate(js_lines) if chunk_re.match(l)]
starts.append(len(js_lines))

orig_chunks = {}
i = 0
while i < len(starts) - 1:
    a, b = starts[i], starts[i + 1]
    block = js_lines[a:b]
    first = block[0]
    if first.strip().startswith("/*"):
        i += 1
        continue
    mobj = re.match(r'^      (?:async function|function|let|const)\s+(\w+)', first)
    name = mobj.group(1)
    orig_chunks[name] = "\n".join(block).rstrip()
    i += 1

FILES = ["state.js", "storage.js", "render.js", "actions.js"]
new_chunks = {}
for file in FILES:
    flines = open(file).read().split("\n")
    fstarts = [i for i, l in enumerate(flines) if chunk_re.match(l) or l.strip() == '"use strict";']
    fstarts.append(len(flines))
    j = 0
    while j < len(fstarts) - 1:
        a, b = fstarts[j], fstarts[j + 1]
        block = flines[a:b]
        first = block[0]
        if first.strip().startswith("/*") or first.strip() == '"use strict";':
            j += 1
            continue
        mobj = re.match(r'^      (?:async function|function|let|const)\s+(\w+)', first)
        if not mobj:
            j += 1
            continue
        name = mobj.group(1)
        if name in new_chunks:
            print(f"DUPLICATE chunk name across files: {name}")
        new_chunks[name] = "\n".join(block).rstrip()
        j += 1

missing = set(orig_chunks) - set(new_chunks)
extra = set(new_chunks) - set(orig_chunks)
mismatches = [n for n in orig_chunks if n in new_chunks and orig_chunks[n] != new_chunks[n]]

print("Missing from new files:", missing or "none")
print("Extra in new files:", extra or "none")
print("Content mismatches:", mismatches or "none")
print(f"Total original chunks: {len(orig_chunks)}, total new chunks: {len(new_chunks)}")
```

```bash
python3 /tmp/chunk_diff.py
```

Expected output:

```
Missing from new files: none
Extra in new files: none
Content mismatches: none
Total original chunks: 84, total new chunks: 84
```

If anything else prints, STOP and report NEEDS_CONTEXT with the full output — do not proceed to Step 3 with a failing diff.

- [ ] **Step 3: Verify the CSS file matches the original `<style>` block exactly**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
python3 -c "
lines = open('index.html').read().split('\n')
s = next(i for i,l in enumerate(lines) if l.strip()=='<style>')
e = next(i for i,l in enumerate(lines) if l.strip()=='</style>')
orig = '\n'.join(lines[s+1:e]).strip('\n')
new = open('styles.css').read().strip('\n')
print('CSS byte-identical:', orig == new)
"
```

Expected: `CSS byte-identical: True`

- [ ] **Step 4: Replace `index.html` with the skeleton**

Now that `styles.css`/`state.js`/`storage.js`/`render.js`/`actions.js` are verified correct and safely on disk, overwrite `index.html` in full with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Carpool planner</title>
    <style>
/* STYLES_PLACEHOLDER */
    </style>
  </head>
  <body>
    <div class="wrap" id="app"></div>

    <script>
/* SCRIPT_PLACEHOLDER */
    </script>
  </body>
</html>
```

- [ ] **Step 5: Clean up the temporary scripts**

```bash
rm -f /tmp/split.py /tmp/chunk_diff.py
```

- [ ] **Step 6: Commit**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
git add index.html styles.css state.js storage.js render.js actions.js
git commit -m "Split index.html into styles.css, state.js, storage.js, render.js, actions.js"
```

Note: `server.ts` still imports `index.html` as the full page at this point, so the app will NOT serve correctly between this commit and Task 2's commit (the skeleton has unreplaced placeholder comments). This is expected — Task 2 immediately follows and fixes serving. Do not attempt to make `server.ts` changes as part of this task.

---

### Task 2: Bundle the split files in `server.ts`

**Files:**
- Modify: `server.ts`

**Interfaces:**
- Consumes: `styles.css`, `state.js`, `storage.js`, `render.js`, `actions.js`, `index.html` (all from Task 1, as text imports).
- Produces: the same `htmlContent` constant `Deno.serve` already returns for `/` — same name, same usage at its one call site (unchanged, outside this diff).

- [ ] **Step 1: Update `server.ts`'s imports and `htmlContent` construction**

Find:

```ts
import htmlContent from "./index.html" with { type: "text" };
```

Replace with:

```ts
import indexTemplate from "./index.html" with { type: "text" };
import styles from "./styles.css" with { type: "text" };
import stateJs from "./state.js" with { type: "text" };
import storageJs from "./storage.js" with { type: "text" };
import renderJs from "./render.js" with { type: "text" };
import actionsJs from "./actions.js" with { type: "text" };

const bundledScript = [stateJs, storageJs, renderJs, actionsJs].join("\n");
const htmlContent = indexTemplate
  .replace("/* STYLES_PLACEHOLDER */", () => styles)
  .replace("/* SCRIPT_PLACEHOLDER */", () => bundledScript);
```

(Using the function form of `.replace()`'s second argument is required here — see the Global Constraints note on the `String.replace()` special-pattern gotcha. Do not simplify this to a plain-string replace.)

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
deno check server.ts
```

Expected: only the pre-existing unrelated `err.message` TS18046 error at the `catch (err)` block — no new errors. If `deno check` complains about the new imports (e.g. an unresolved module), STOP and report NEEDS_CONTEXT — do not add type suppressions to work around it.

- [ ] **Step 3: Full end-to-end verification against the reference snapshot**

This is the strongest available proof that the bundled output is correct: start the real server, fetch `/`, and compare its CSS block byte-for-byte against the pre-captured original, and its script block chunk-for-chunk (same technique as Task 1's verification, since the script is legitimately reordered) against the pre-captured original.

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
(deno run --allow-net --allow-env server.ts > /tmp/server.log 2>&1 &)
sleep 1.5
curl -s http://localhost:8000/ -o /tmp/live-response.html
pkill -f "deno run --allow-net --allow-env server.ts"
cat /tmp/server.log
```

Expected: log shows `Listening on http://0.0.0.0:8000/` with no runtime errors.

Then verify structurally against `.superpowers/sdd/original-response.html`:

```bash
python3 -c "
import re

def extract(path):
    lines = open(path).read().split('\n')
    ss = next(i for i,l in enumerate(lines) if l.strip()=='<style>')
    se = next(i for i,l in enumerate(lines) if l.strip()=='</style>')
    js_s = next(i for i,l in enumerate(lines) if l.strip()=='<script>')
    js_e = next(i for i,l in enumerate(lines) if l.strip()=='</script>')
    return '\n'.join(lines[ss+1:se]).strip('\n'), '\n'.join(lines[js_s+1:js_e]).strip('\n')

orig_css, orig_js = extract('.superpowers/sdd/original-response.html')
live_css, live_js = extract('/tmp/live-response.html')

print('CSS byte-identical:', orig_css == live_css)

chunk_re = re.compile(r'^      (async function |function |let |const |/\*)')

def chunks_by_name(js_text):
    lines = js_text.split('\n')
    starts = [i for i,l in enumerate(lines) if chunk_re.match(l) or l.strip() == '\"use strict\";']
    starts.append(len(lines))
    out = {}
    for i in range(len(starts)-1):
        block = lines[starts[i]:starts[i+1]]
        first = block[0]
        if first.strip().startswith('/*') or first.strip() == '\"use strict\";':
            continue
        m = re.match(r'^      (?:async function|function|let|const)\s+(\w+)', first)
        if m:
            out[m.group(1)] = '\n'.join(block).rstrip()
    return out

orig_chunks = chunks_by_name(orig_js)
live_chunks = chunks_by_name(live_js)
missing = set(orig_chunks) - set(live_chunks)
extra = set(live_chunks) - set(orig_chunks)
mismatches = [n for n in orig_chunks if n in live_chunks and orig_chunks[n] != live_chunks[n]]
print('Missing from live response:', missing or 'none')
print('Extra in live response:', extra or 'none')
print('Content mismatches:', mismatches or 'none')
print(f'Original chunks: {len(orig_chunks)}, live chunks: {len(live_chunks)}')
"
```

Expected:

```
CSS byte-identical: True
Missing from live response: none
Extra in live response: none
Content mismatches: none
Original chunks: 84, live chunks: 84
```

If anything else prints, this is a real failure — STOP and report BLOCKED with the full output. Do not commit a bundling that fails this check.

- [ ] **Step 4: Clean up**

```bash
rm -f /tmp/server.log /tmp/live-response.html
```

- [ ] **Step 5: Commit**

```bash
cd /Users/maxverhoef/ClaudeProjects/carpool-planner
git add server.ts
git commit -m "Bundle split source files into one served response in server.ts"
```

---

## Final Verification (after both tasks)

- [ ] `deno check server.ts` — only the pre-existing `err.message` TS18046 error should remain.
- [ ] Run `deno task start`, `curl http://localhost:8000/`, and re-run Task 2 Step 3's structural comparison against `.superpowers/sdd/original-response.html` one more time from a clean state, to catch anything a partial re-run might have missed.
- [ ] `git log --oneline -2` shows the two task commits.
- [ ] Manual browser check (no browser access in this environment, same standing caveat as prior plans): open the app, confirm it looks and behaves identically to before — sign in, view cars/pool, create a trip. This is a pure reorganization so a real click-through is lower-risk than prior feature batches, but still recommended once before considering this fully done.
