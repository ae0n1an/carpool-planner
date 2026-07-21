      async function createTrip() {
        const name = document.getElementById("c-name").value.trim();
        if (!name) {
          document.getElementById("c-name").focus();
          return;
        }
        const id = uid() + uid();
        ev = {
          id,
          name,
          date: document.getElementById("c-date").value,
          dest: document.getElementById("c-dest").value.trim(),
          arriveBy: document.getElementById("c-arrive").value,
          people: {},
        };
        evId = id;
        await saveEvent();
        try {
          history.replaceState(null, "", "#" + id);
        } catch (e) {}
        await openEvent(id);
      }


      async function openEvent(id) {
        ev = await loadEvent(id);
        if (!ev) {
          notFound = true;
          view = "landing";
          render();
          return;
        }
        notFound = false;
        evId = id;
        lastSnapshot = JSON.stringify(ev);
        const sess = await stGet("cp-me-" + id, false);
        me = sess && ev.people[sess] ? sess : null;
        view = "event";
        startPolling();
        render();
      }


      function backToLanding() {
        view = "landing";
        ev = null;
        evId = null;
        me = null;
        notFound = false;
        stopPolling();
        try {
          history.replaceState(null, "", location.pathname + location.search);
        } catch (e) {}
        render();
      }


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


      function copyShare(btn) {
        try {
          navigator.clipboard.writeText(shareUrl());
        } catch (e) {}
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy link";
        }, 1500);
      }


      async function shareEvent(btn) {
        if (navigator.share) {
          try {
            await navigator.share({
              title: ev && ev.name ? ev.name : "Carpool planner",
              text:
                ev && ev.name
                  ? `Join "${ev.name}" on Carpool planner`
                  : "Join this carpool trip",
              url: shareUrl(),
            });
          } catch (e) {
            /* user cancelled or share failed — no-op */
          }
        } else {
          copyShare(btn);
        }
      }


      async function signIn() {
        const name = document.getElementById("si-name").value.trim();
        const pw = document.getElementById("si-pw").value;
        const err = document.getElementById("si-err");
        if (!name) {
          document.getElementById("si-name").focus();
          return;
        }
        const k = keyOf(name);
        const latest = await loadEvent(evId);
        if (latest) ev = latest;
        const existing = ev.people[k];
        if (existing && existing.pw && existing.pw !== hash(pw)) {
          err.textContent =
            "That name's taken and the password doesn't match. Are you them? Try again, or pick another name.";
          err.style.display = "block";
          return;
        }
        if (!existing) {
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
          await saveEvent();
        } else if (pw && !existing.pw) {
          existing.pw = hash(pw);
          await saveEvent();
        }
        me = k;
        await stSet("cp-me-" + evId, k, false);
        render();
      }


      async function signOut() {
        me = null;
        await stSet("cp-me-" + evId, "", false);
        render();
      }


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


      function claimManual(dk, mid) {
        mutate((e) => {
          const d = e.people[dk];
          const list = d.manualPax || [];
          const idx = list.findIndex((m, i) => (m.id || "i" + i) === mid);
          if (idx < 0) return;
          const entry = list[idx];
          list.splice(idx, 1);
          const p = e.people[me];
          p.carOf = dk;
          if (!p.loc && entry.loc) p.loc = entry.loc;
          if (!p.role) p.role = "ride";
          d.paxOrder = (d.paxOrder || []).map((x) =>
            x === "m:" + mid ? "p:" + me : x
          );
        });
      }

      function dismissManual(mid) {
        const p = ev.people[me];
        saveMe({ dismissed: [...(p.dismissed || []), mid] });
      }


      function setSeats(inp) {
        const v = Math.max(1, Math.min(12, parseInt(inp.value, 10) || 1));
        const p = ev.people[me];
        if (p.role === "drive" && v < carStats(me).used) {
          pendingSeatChange = v;
          render();
          return;
        }
        saveMe({ seats: v });
      }

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
        if (!navigator.geolocation) {
          flashBtn(btn, "Not supported");
          return;
        }
        btn.textContent = "Locating\u2026";
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

      function flashBtn(btn, msg) {
        const orig = "Locate me";
        btn.textContent = msg;
        setTimeout(() => {
          if (btn.isConnected) btn.textContent = orig;
        }, 2000);
      }


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

      async function addManualPax(dk) {
        const n = document.getElementById("mp-name").value.trim();
        const loc = document.getElementById("mp-loc").value.trim();
        if (!n) return;
        addingPaxFor = null;
        await mutate((e) => {
          const d = e.people[dk];
          if (!d.manualPax) d.manualPax = [];
          if (carStatsIn(e, dk).used < carStatsIn(e, dk).cap)
            d.manualPax.push({ id: uid(), n, loc });
        });
      }


      async function moveStop(dk, id, dir) {
        await mutate((e) => {
          const d = e.people[dk];
          const order = orderedStopsIn(e, dk);
          const i = order.indexOf(id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= order.length) return;
          order.splice(i, 1);
          order.splice(j, 0, id);
          d.paxOrder = order;
        });
      }

      /* ------------------------------------------------------------------ */
      /* Polling                                                             */
      /* ------------------------------------------------------------------ */
      function startPolling() {
        stopPolling();
        pollTimer = setInterval(async () => {
          if (view !== "event" || !evId) return;
          const ael = document.activeElement;
          if (
            ael &&
            (ael.tagName === "INPUT" ||
              ael.tagName === "SELECT" ||
              ael.tagName === "TEXTAREA")
          )
            return;
          if (pendingSeatChange || addingPaxFor) return;
          if (pendingWrites > 0 || Date.now() - lastLocalEdit < 1500) return;
          const raw = await stGet("cp-ev-" + evId, true);
          if (raw && raw !== lastSnapshot) {
            lastSnapshot = raw;
            ev = JSON.parse(raw);
            if (me && !ev.people[me]) me = null;
            render();
          }
        }, 2000);
      }

      function stopPolling() {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }


      /* ------------------------------------------------------------------ */
      function boot() {
        const h = (typeof location !== "undefined" ? location.hash : "")
          .replace("#", "")
          .trim();
        if (h) {
          openEvent(h);
        } else {
          view = "landing";
          render();
        }
      }
      window.addEventListener("hashchange", boot);
      boot();
