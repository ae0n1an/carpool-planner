      /* ------------------------------------------------------------------ */
      /* Derived model                                                       */
      /* ------------------------------------------------------------------ */
      function drivers() {
        return Object.keys(ev.people).filter(
          (k) => ev.people[k].role === "drive"
        );
      }

      function occupantsOf(dk) {
        return Object.keys(ev.people).filter(
          (k) => k !== dk && ev.people[k].carOf === dk
        );
      }

      function carStats(dk) {
        const d = ev.people[dk];
        const occ = occupantsOf(dk);
        const manual = d.manualPax || [];
        const cap = Math.max(1, parseInt(d.seats || 0, 10) || 0);
        return { occ, manual, cap, used: occ.length + manual.length };
      }

      function pool() {
        return Object.keys(ev.people).filter((k) => {
          const p = ev.people[k];
          return p.role !== "drive" && !p.carOf;
        });
      }

      function seatShortage() {
        let cap = 0;
        drivers().forEach((dk) => {
          cap += carStats(dk).cap;
        });
        let need = 0;
        Object.keys(ev.people).forEach((k) => {
          if (ev.people[k].role !== "drive") need++;
        });
        drivers().forEach((dk) => {
          need += (ev.people[dk].manualPax || []).length;
        });
        return need - cap;
      }


      /* ------------------------------------------------------------------ */
      /* Rendering                                                           */
      /* ------------------------------------------------------------------ */
      const app = document.getElementById("app");

      function render() {
        if (view === "landing") renderLanding();
        else renderEvent();
      }


      function renderLanding() {
        app.innerHTML = `
    <div class="topbar" style="justify-content:center;"><h1>Carpool planner</h1></div>
    ${
      hasStore
        ? ""
        : `<div class="notice">Shared storage isn't available here — running in demo mode, data won't persist.</div>`
    }
    ${
      notFound
        ? `<div class="notice">That trip link didn't match anything — it may be mistyped. Create a new trip below.</div>`
        : ""
    }
    <div class="card" style="max-width:420px; margin:0 auto;">
      <h2 style="margin-bottom:4px;">Create a trip</h2>
      <p class="tiny" style="margin:0 0 12px;">You'll get a unique link to share — anyone with it can join.</p>
      <div class="field"><label>Trip name</label><input type="text" id="c-name" placeholder="Weekend trip"></div>
      <div class="field"><label>Date</label><input type="date" id="c-date"></div>
      <div class="field"><label>Destination</label><input type="text" id="c-dest" placeholder="Blue Mountains"></div>
      <div class="field"><label>Aim to arrive by (optional)</label><input type="time" id="c-arrive"></div>
      <button class="primary" style="width:100%;" onclick="createTrip()">Create trip</button>
    </div>`;
      }


      /* ---------- event view ---------- */
      function renderEvent() {
        const short = seatShortage();
        let shortLine = "";
        if (drivers().length && short > 0) {
          shortLine = `<span class="hint-warn">${short} seat${
            short > 1 ? "s" : ""
          } short</span>`;
        }
        app.innerHTML = `
    <div class="topbar">
      <div>
        <button class="small" style="margin-top:8px;" onclick="backToLanding()">New trip</button>
        <h1>${esc(ev.name)}</h1>
        <p class="muted" style="margin:4px 0 0;">${esc(ev.date || "date TBC")}${
          ev.dest ? ` &middot; to ${mapLink(ev.dest)}` : ""
        }${
          ev.arriveBy
            ? ` &middot; aim to arrive by <b>${esc(ev.arriveBy)}</b>`
            : ""
        }</p>
      </div>
      <div style="max-width:480px;">
        <div class="row" style="flex-wrap:wrap; justify-content:flex-end;">
          <button class="small primary" onclick="shareEvent(this)">Share</button>
          <button class="small" onclick="copyShare(this)">Copy link</button>
        </div>
        <code id="share-code" style="display:block; margin-top:6px; font-size:11px; color:var(--text2); word-break:break-all; text-align:right;">${esc(
          shareUrl()
        )}</code>
        <p class="tiny" style="margin:4px 0 0; text-align:right;">Share this link so others can join — anyone with it can view and join, nothing private is shared.</p>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:1fr;">
      <div style="max-width:420px; margin:0 auto 14px;">${
        me ? youPanel() : signInPanel()
      }</div>
      <div>
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
          <div class="field"><label>Leaving at</label>
            <input type="time" id="ac-leave"></div>
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
        <div class="card" style="margin-top:14px;">
          <div class="row" style="justify-content:space-between; flex-wrap:wrap;">
            <h2>Not in a car yet (${pool().length})</h2>${shortLine}
          </div>
          ${
            pool().length
              ? pool().map(poolRow).join("")
              : `<p class="muted" style="margin:8px 0 0;">Everyone's sorted.</p>`
          }
        </div>
      </div>
    </div>`;
      }


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


      function shareUrl() {
        return typeof location !== "undefined"
          ? location.href.split("#")[0] + "#" + evId
          : "#" + evId;
      }


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


      /* ---- claiming driver-added entries that match my name ---- */
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
            (x) => `<div class="notice">${esc(
              ev.people[x.dk].name
            )} added "${esc(x.m.n)}"${
              x.m.loc ? ` (${esc(x.m.loc)})` : ""
            } to their car — is that you?
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

      /* ---------- cars ---------- */
      function orderedStops(dk) {
        const d = ev.people[dk];
        const occ = occupantsOf(dk);
        const manual = d.manualPax || [];
        const ids = [];
        occ.forEach((k) => ids.push("p:" + k));
        manual.forEach((m, i) => ids.push("m:" + (m.id || "i" + i)));
        const order = (d.paxOrder || []).filter((id) => ids.includes(id));
        ids.forEach((id) => {
          if (!order.includes(id)) order.push(id);
        });
        return order;
      }

      function stopInfo(dk, id) {
        if (id.startsWith("p:")) {
          const p = ev.people[id.slice(2)];
          return p
            ? { name: p.name, loc: p.loc, manual: false, note: p.note }
            : null;
        }
        const key = id.slice(2);
        const m = (ev.people[dk].manualPax || []).find(
          (mm, i) => (mm.id || "i" + i) === key
        );
        return m ? { name: m.n, loc: m.loc, manual: true, note: null } : null;
      }


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
          carConfirmBlock += `<div class="notice">Removing your car sends your ${
            stats.used
          } passenger${stats.used > 1 ? "s" : ""} back to the pool.
      <div class="row" style="margin-top:8px;">
        <button class="small danger" onclick="confirmRemoveCar()">Remove anyway</button>
        <button class="small" onclick="cancelRemoveCar()">Cancel</button>
      </div></div>`;
        }
        return `<div class="card" style="padding:12px;">
    <div class="row" style="justify-content:space-between; margin-bottom:2px;">
      <div>
        <span style="font-weight:600; font-size:14px;">${esc(
          d.name
        )}'s car &middot; ${stats.cap + 1} seats</span>
        <p class="muted" style="margin:0;">${
          d.loc ? mapLink(d.loc) : "start TBC"
        }${ev.dest ? ` → ${mapLink(ev.dest)}` : ""}${
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
            : `<span class="badge" style="background:${ramp.l}; color:${ramp.d}; cursor:pointer;" onclick="editingSeats=true; render();" title="Edit seats">${stats.used}/${stats.cap}</span>`
          : `<span class="badge" style="background:${ramp.l}; color:${ramp.d};">${stats.used}/${stats.cap}</span>`
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
    <div class="row" style="margin-top:10px;">
      <button class="small" style="flex:1;" onclick="window.open('${mapsUrl}','_blank')">Open in Google Maps</button>
      ${joinLeave}
    </div>
  </div>`;
      }


      function seatLayout(count) {
        const pos = [
          [60, 44],
          [100, 44],
        ];
        let y = 96,
          remaining = count - 2;
        while (remaining > 0) {
          const inRow = Math.min(3, remaining);
          const xs =
            inRow === 1 ? [80] : inRow === 2 ? [56, 104] : [40, 80, 120];
          xs.forEach((x) => pos.push([x, y]));
          remaining -= inRow;
          y += 48;
        }
        return { pos: pos.slice(0, count), height: y - 48 + 36 };
      }


      function carSVG(dk, ramp) {
        const d = ev.people[dk];
        const stats = carStats(dk);
        const total = stats.cap + 1;
        const { pos, height } = seatLayout(total);
        const stops = orderedStops(dk);
        const cells = [{ t: "driver", n: d.name }];
        stops.forEach((id) => {
          const s = stopInfo(dk, id);
          if (s) cells.push({ t: s.manual ? "manual" : "taken", n: s.name });
        });
        while (cells.length < total) cells.push({ t: "open" });
        const canClaim =
          me &&
          me !== dk &&
          ev.people[me].role !== "drive" &&
          !ev.people[me].carOf &&
          stats.used < stats.cap;
        const seats = pos
          .map((p, i) => {
            const c = cells[i];
            const open = c.t === "open";
            const manual = c.t === "manual";
            const fill = open ? "#fff" : manual ? "var(--amber)" : ramp.c;
            const stroke = open
              ? "var(--border-strong)"
              : manual
              ? "var(--amber-m)"
              : ramp.c;
            const label = open ? "" : initials(c.n);
            const click =
              open && canClaim ? `onclick="claimSeat('${dk}')"` : "";
            return `<g class="seat ${open && canClaim ? "open" : ""}" ${click}>
      <rect x="${p[0] - 16}" y="${
              p[1] - 16
            }" width="32" height="32" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${
              open ? 'stroke-dasharray="4 3"' : ""
            }/>
      ${
        open
          ? `<text x="${p[0]}" y="${
              p[1] + 5
            }" text-anchor="middle" font-size="14" fill="var(--text3)">${
              canClaim ? "+" : ""
            }</text>`
          : `<text x="${p[0]}" y="${
              p[1] + 4
            }" text-anchor="middle" font-size="11" font-weight="600" fill="${
              manual ? "var(--amber-d)" : "#fff"
            }">${esc(label)}</text>`
      }
      ${
        i === 0
          ? `<text x="${p[0]}" y="${
              p[1] - 21
            }" text-anchor="middle" font-size="9" fill="${
              ramp.m
            }">driver</text>`
          : ""
      }
    </g>`;
          })
          .join("");
        const h = height + 14;
        return `<svg viewBox="0 0 160 ${h}" width="120" height="${Math.round(
          h * 0.75
        )}" role="img" aria-label="${esc(d.name)}'s car seat map">
    <rect x="20" y="4" width="120" height="${h - 8}" rx="28" fill="${
          ramp.l
        }" stroke="${ramp.m}" stroke-width="1.5"/>
    <path d="M 34 62 Q 80 50 126 62" fill="none" stroke="${
      ramp.m
    }" stroke-width="1.5" opacity="0.5"/>
    ${seats}
  </svg>`;
      }


      function carStatsIn(e, dk) {
        const d = e.people[dk];
        const occ = Object.keys(e.people).filter(
          (k) => k !== dk && e.people[k].carOf === dk
        );
        const manual = d.manualPax || [];
        const cap = Math.max(1, parseInt(d.seats || 0, 10) || 0);
        return { cap, used: occ.length + manual.length };
      }


      function orderedStopsIn(e, dk) {
        const d = e.people[dk];
        const occ = Object.keys(e.people).filter(
          (k) => k !== dk && e.people[k].carOf === dk
        );
        const ids = occ
          .map((k) => "p:" + k)
          .concat((d.manualPax || []).map((m, i) => "m:" + (m.id || "i" + i)));
        const order = (d.paxOrder || []).filter((x) => ids.includes(x));
        ids.forEach((x) => {
          if (!order.includes(x)) order.push(x);
        });
        return order;
      }


      /* ---------- pool ---------- */
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
