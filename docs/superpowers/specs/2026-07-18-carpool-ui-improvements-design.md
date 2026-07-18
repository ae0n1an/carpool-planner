# Carpool Planner UI Improvements — Design

## Context

`carpool-planner` is a single-file Deno app (`server.ts` importing `index.html`
as text). The event/car/passenger data model, `render()` cycle, and
`mutate()`/`saveMe()` persistence pattern are unchanged by this work — this
is a batch of UI/UX improvements layered on the existing model, all
contained in `index.html`.

The master-list / pre-registered-attendees idea (event creator enters
attendees up front, replacing open sign-in-by-name) was raised but is
explicitly out of scope for this batch — deferred to a future design if
pursued.

## Changes

### 1. Copy polish
- Placeholders: trip name `"Weekend trip"`, destination `"Blue Mountains"`,
  note `"Bringing a cooler"` (replacing the Torquay-surf-trip-specific
  examples).
- Location placeholders tightened to push a full address instead of a
  suburb: `"Full street address"` (personal location field),
  `"Address"` (manual-add-passenger location field). No geocoding/autocomplete
  dependency added.
- Explanatory line next to "Copy link" in the event header (not just on the
  create screen): e.g. `"Anyone with this link can view and join — nothing
  private is shared."`

### 2. Passenger notes visibility
`stopInfo()` currently returns `{name, loc, manual}` for real passengers,
dropping `p.note`. Add `note: p.note` to that object and render it in
`stopRows` the same way the driver's own note is already shown (muted
italic), so a passenger's note stays visible once they're in a car.

### 3. Car card actions
- **Join/Leave on the card**: remove the "Leave this car" button from the
  personal status panel (`detailsPanel()`). On each `carCard()`, in that
  same visual slot: if you're an occupant of that car → "Leave this car"
  (calls existing `leaveCar()`); else if you're eligible to join (ride
  role, no car yet, seats free) → "Join this car" (calls existing
  `claimSeat(dk)`).
- **Invite from pool**: driver-only control next to "+ Add passenger" —
  "+ Invite from pool", listing `pool()` names (people with no car yet).
  Clicking a name sets `p.carOf = dk` directly (assigns immediately, no
  acceptance step), via `mutate()`.
- **Remove from car**: driver-only `×` control on each stop row, calling
  new `removeFromCar(dk, id)` — for `p:` ids sets that person's
  `carOf = null`; for `m:` ids splices them out of `d.manualPax`. Works
  uniformly for self-joined, invited, and manually-added (phantom)
  passengers.

### 4. Clickable map locations
Each of the following becomes a link to
`https://www.google.com/maps/search/?api=1&query=<encoded text>`, opened in
a new tab, instead of plain text:
- Each passenger/manual stop row's location.
- The driver's start location, in both places it appears: the car card
  summary line and the "S" stop row.
- The destination stop row within each car card.
- The trip destination shown in the event header topbar (`ev.dest`).

The existing full-route "Open in Google Maps" button (all stops in one
directions link) is unchanged.

## Out of scope
- Master-list / pre-registered-attendee data model change.
- Address autocomplete/geocoding for the "precise location" field.
- Any change to the existing `geoLocate()` reverse-geocoding ("Locate me")
  flow.
