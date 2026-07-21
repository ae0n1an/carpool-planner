      "use strict";

      /* ------------------------------------------------------------------ */
      /* Helpers                                                             */
      /* ------------------------------------------------------------------ */
      function esc(s) {
        return String(s == null ? "" : s).replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            }[c])
        );
      }

      function mapLink(text) {
        if (!text) return "";
        return `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          text
        )}" target="_blank" rel="noopener">${esc(text)}</a>`;
      }

      function hash(s) {
        let h = 5381;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        }
        return "h" + h.toString(36);
      }

      function uid() {
        return Math.random().toString(36).slice(2, 8);
      }

      function keyOf(name) {
        return name.trim().toLowerCase();
      }

      function initials(n) {
        return n.trim().slice(0, 2).toUpperCase();
      }

      const RAMPS = [
        {
          c: "var(--teal)",
          l: "var(--teal-l)",
          d: "var(--teal-d)",
          m: "var(--teal-m)",
        },
        {
          c: "var(--purple)",
          l: "var(--purple-l)",
          d: "var(--purple-d)",
          m: "var(--purple-m)",
        },
        {
          c: "var(--pink)",
          l: "var(--pink-l)",
          d: "var(--pink-d)",
          m: "var(--pink-m)",
        },
        {
          c: "var(--blue)",
          l: "var(--blue-l)",
          d: "var(--blue-d)",
          m: "var(--blue-m)",
        },
      ];


      /* ------------------------------------------------------------------ */
      /* App state                                                           */
      /* ------------------------------------------------------------------ */
      let view = "landing"; // landing | event

      let notFound = false;

      let ev = null; // current event object

      let evId = null;

      let me = null; // my person key, or null

      let pendingSeatChange = null;

      let addingPaxFor = null;

      let addingInviteFor = null;

      let addingCar = false;

      let editingSeats = false;

      let pendingRemoveCar = false;

      let editingMyLoc = false;

      let editingMyNote = false;

      let lastSnapshot = "";

      let pollTimer = null;
