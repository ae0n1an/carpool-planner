# Pool-First Signup Flow — Design

## Context

Today, once someone signs in to an event, `detailsPanel()` renders a
permanent form in the left column of the event grid: radio buttons for
role ("I can drive" / "I need a ride"), and — depending on role — seats,
location, "meet anywhere", leaving-at time, and a note field. Nobody can do
anything else on the page until they've picked a role.

This redesign removes that form. Signing in drops you straight into "Not in
a car yet" with no role decision required. Driving becomes an explicit
action ("+ Add my car") taken from the Cars section, not a fork at the top
of a form. This is a `when2meet`-style shift: default to the passive pool
state, opt in to the active (driving) state.

The master-list / pre-registered-attendees idea from an earlier
conversation remains out of scope — unrelated to this change, still
deferred.

## Data model

No schema changes. `signIn()` already initializes new people with
`role: null` ([index.html:792](index.html#L792)) — today's form immediately
forces a choice; this redesign just stops forcing it. `pool()`'s existing
filter (`role !== "drive"`) already treats `role: null` as pool-eligible, so
no change there. The `"ride"` role value and the `undecided` distinction
(today's `poolRow()` badge) are dropped — every non-driver is simply "in the
pool," full stop.

`flex` ("could drive if needed") and `meet` ("happy to meet anywhere") keep
their existing fields and meaning; they're no longer gated behind picking
role `"ride"` first (today: `isRide && p.flex` at
[index.html:824](index.html#L824)) — any pool member can set them directly.

## Changes

### 1. Layout: form disappears once signed in

`renderEvent()`'s grid ([index.html:680-681](index.html#L680-L681)) currently
renders `detailsPanel()` (signed in) or `signInPanel()` (not signed in) in a
fixed-width left column next to Cars/pool. Change: when `me` is set, drop
the left column entirely and render Cars/pool at full width (single
column). When `me` is null, keep today's two-column layout
(`signInPanel()` alongside Cars/pool, viewable before signing in — unchanged
behavior). `detailsPanel()` itself is deleted; nothing replaces it as a
standing panel.

### 2. Pool rows: read-only for others, editable for you

`poolRow(k)` ([index.html:1511](index.html#L1511)) currently renders a
static row for everyone, with an "undecided" badge dropped per the section
above.

- For `k !== me`: same static row as today, minus the `undecided` badge,
  location rendered via `mapLink()` (consistent with the rest of the app;
  today it's plain `esc(p.loc)`).
- For `k === me`: the row instead renders inline, always-visible inputs —
  location text field + the existing "Locate me" button
  (`geoLocate()`), a note text field, a "could drive if needed" checkbox
  (`flex`), a "happy to meet anywhere" checkbox (`meet`), and a small
  "Sign out" action (calls the existing `signOut()`). All inputs save via
  the existing `saveMe()` on change, same autosave pattern as today's form.

`geoLocate()` ([index.html:1070](index.html#L1070)) currently hardcodes
`document.getElementById("my-loc")` as its target input. Since a location
input will now exist in two different contexts (your pool row, and the new
"Add my car" form below) that are never both on screen for the same person
at once, `geoLocate()` needs to take the target input's id (or element)
as a parameter instead of hardcoding `"my-loc"`, and each call site passes
its own input's id.

### 3. "+ Add my car"

New control in the Cars section header
([index.html:683-690](index.html#L683-L690)), visible whenever `me` is set
and `ev.people[me].role !== "drive"`. Opens a small inline form — same
visual pattern as the existing `addForm`/`inviteForm` toggles on
`carCard()` — with two fields: seats (number input) and departure location
(text input + "Locate me" button). Submitting:

```js
await mutate((e) => {
  const p = e.people[me];
  p.role = "drive";
  p.seats = seats;
  p.loc = loc;
  p.carOf = null;
  p.flex = false;
});
```

This is the same effective transition `applyRole('drive')`
([index.html:966-975](index.html#L966-L975)) performs today, just
collecting seats/location in the same step instead of two.

### 4. Seats: always-visible editable control on your own car card

On `carCard()` ([index.html:1158](index.html#L1158)), when `mine`, the
seat count becomes an always-visible small number input next to the
existing `${stats.cap + 1} seats` / seat-count badge
([index.html:1263-1280](index.html#L1263-L1280)), wired to the existing
`setSeats(inp)` ([index.html:1035](index.html#L1035)) — including its
existing confirm-before-shrinking-below-current-passengers flow
(`pendingSeatChange`/`confirmSeatChange()`), unchanged. For everyone else
viewing the card, the seat count stays a plain badge as today.

### 5. Location, leaving-at, note: "Edit car details" toggle

Also on `carCard()`, when `mine`: a new "Edit car details" toggle button
(collapsible form, same interaction pattern as `addForm`/`inviteForm` —
a new `editingCarFor` state variable mirroring `addingPaxFor`/
`addingInviteFor`) containing: departure location (text input + "Locate
me"), leaving-at time input, and note text input, prefilled from the
driver's current values. "Save" writes all three via `mutate()`/`saveMe()`
in one action; "Cancel" closes the form without changes. This replaces the
"Departing from", "Leaving at", and "Note for the group" fields that used
to live in `detailsPanel()` for a driver.

### 6. "Remove my car"

New button on `carCard()`, `mine`-only, next to the seats control from
item 4. Reuses the exact confirm-if-you-have-passengers flow the deleted
`detailsPanel()`'s role-switch used
(`confirmRoleSwitch()`/`cancelRoleSwitch()`,
[index.html:976-992](index.html#L976-L992)): if `carStats(me).used > 0`,
show a confirmation notice on the card before bumping passengers back to
the pool; otherwise apply immediately. The underlying mutation (clear
`role`, `manualPax`, `paxOrder`, and any passengers' `carOf`) is unchanged
from today's `confirmRoleSwitch()` — only the trigger point (a button on
your own car card instead of a radio button in a deleted form) and the
target role (going to "not driving" — no role — instead of switching
between two explicit role values) change.

### 7. Manual-match claim prompts move to the Cars section

The "X added '[name]' to their car — is that you?" prompts
(`manualMatches()`, currently rendered inside `detailsPanel()` at
[index.html:861-875](index.html#L861-L875)) move to a notice banner at the
top of the Cars section (above the cars grid /
"No cars yet" message), shown whenever `manualMatches()` returns entries
for the signed-in viewer. `manualMatches()`, `claimManual()`,
`dismissManual()` themselves are unchanged — only where the resulting
markup is rendered moves.

### Untouched

Join/leave a car, invite-from-pool, remove-from-car (passenger-level, on
stop rows), map links, the seat SVG, sign-in itself (`signInPanel()`/
`signIn()`), `geoLocate()`'s reverse-geocoding logic (only its target-input
parameterization changes, per item 2) — everything from the previous batch
of car-card work stays as-is.

## Out of scope

- Master-list / pre-registered-attendee data model change (deferred
  separately, unrelated to this change).
- Any change to how drivers manage passengers (add/invite/remove) beyond
  relocating the claim-prompt banner.
