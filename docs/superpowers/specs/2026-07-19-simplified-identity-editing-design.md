# Simplified Identity & Editing — Design

## Context

The pool-first redesign (previous spec/plan) split editing across three
places: an inline form on your own pool row (location, note, two
checkboxes), an always-visible seats input on your own car card, and a
collapsible "Edit car details" form on your own car card (location,
leaving-at, note — duplicating location/note from the pool row once you're
driving). This spec consolidates that into one place for identity fields,
drops two little-used toggles, and makes the remaining per-car controls
inline instead of hidden behind a form toggle.

## Changes

### 1. Universal "You" panel

New persistent block at the top of the event page content (same slot
currently occupied by `signInPanel()` when not signed in — i.e., above the
"Cars" heading, full width, matching the card treatment already used
there). Shown whenever `me` is set. Contains: avatar + name, a location
field (click-to-edit in place against the displayed value — clicking your
current location text turns it into a text input + "Locate me" button;
saving reverts it to displayed text via `mapLink()`), a note field (same
click-to-edit-in-place pattern), and "Sign out". This is now the *only*
place location/note are edited, for both pool members and drivers — a
driver's `d.loc`/`d.note` and a pool member's `p.loc`/`p.note` are the same
fields on the same person record, so editing them here is correct
regardless of role.

### 2. `poolRow()` — always read-only

No more `mine` branch, no inline inputs, no checkboxes. Every row (yours
included) renders the same: avatar, name, location via `mapLink()`, note.
`flexBadge`/`meetBadge` are removed (see item 4). Editing your own info now
happens exclusively in the "You" panel (item 1).

### 3. Car card — seats and leaving-at become inline-editable at their
display, location/note editing removed entirely

- **Seats:** replace the always-visible number `<input>` with a
  click-to-edit toggle at the seat badge itself — clicking the badge
  (`${stats.used}/${stats.cap}`) swaps it for a number input wired to the
  existing `setSeats(inp)` (unchanged, including its confirm-before-shrink
  flow); committing (`onchange`) reverts to the badge display. Same
  mechanism as location's click-to-edit in the You panel, applied here.
- **Leaving at:** becomes an always-visible small time input directly in
  the summary line, next to where "departs HH:MM" is currently shown
  (replacing the static text with an editable one), instead of living
  inside a toggle form. Saves directly via `mutate()`/`saveMe()` on change.
- **Location, note:** no longer editable from the car card at all — they're
  edited exclusively via the You panel (item 1) now. The car card still
  *displays* both (`mapLink(d.loc)`, `d.note` as before) — just no edit
  affordance here.
- **"Edit car details" toggle, `editingCarFor` state variable, and
  `saveCarDetails()` are deleted entirely** — nothing is left for that form
  to do once location/note move out and leaving-at becomes inline.

### 4. Drop `flex` ("could drive if needed") and `meet` ("happy to meet
anywhere") completely

- Removed from `signIn()`'s new-person object (no longer initialized).
- Removed from `poolRow()` (`flexBadge`, `meetBadge`, and the
  flex-conditional avatar background color — avatars use a single
  consistent color now).
- Removed from `addCar()` (no more `p.flex = false`).
- `seatShortage()`'s hint in `renderEvent()` currently suggests a specific
  flex-tagged person ("N seats short — X could drive") via `flexFolk`; that
  suggestion is dropped, leaving a plain "N seats short" hint with no named
  suggestion. `seatShortage()` itself (the count) is unchanged.
- People who want to signal either of these things going forward just say
  so in their note — free text, no structured field.

### 5. `addCar()` no longer asks for location

The "+ Add my car" form drops its location input entirely; it only asks
for seats and leaving-at. On submit, the driver's existing `p.loc`
(already set via the You panel, empty string if they haven't set one yet —
same permissive behavior as today) becomes the car's departure location
automatically, since it's the same field on the same person record. No
change to `p.loc` is made by `addCar()` itself.

### 6. Destination

Already optional today — `createTrip()` has no validation on `c-dest`, and
every downstream read already guards on `ev.dest ? ... : ""`. No change
needed.

## Out of scope

- Master-list / pre-registered-attendee data model change (still deferred,
  unrelated).
- Any change to `removeCar()`/`confirmRemoveCar()`, `claimSeat()`,
  `removeFromCar()`, `inviteFromPool()`, manual-passenger flow, map links,
  or the seat SVG — all untouched by this batch.
