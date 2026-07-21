      /* ------------------------------------------------------------------ */
      /* Storage adapter: interfaces with Deno KV API backend               */
      /* falls back to in-memory if server API is unavailable.              */
      /* ------------------------------------------------------------------ */
      const mem = {};

      // Polyfill window.storage to talk to our Deno backend
      window.storage = {
        async get(key) {
          const res = await fetch("/api/storage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get", key }),
          });
          return res.json(); // returns { value: ... }
        },
        async set(key, value) {
          const res = await fetch("/api/storage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set", key, value }),
          });
          return res.json(); // returns { success: true }
        },
        async list(prefix) {
          const res = await fetch("/api/storage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list", prefix }),
          });
          return res.json(); // returns { keys: [...] }
        },
      };


      const hasStore = typeof window !== "undefined" && !!window.storage;


      async function stGet(key, shared) {
        if (!shared) {
          try {
            return localStorage.getItem(key);
          } catch (e) {
            return mem[key] !== undefined ? mem[key] : null;
          }
        }
        if (!hasStore) {
          return mem[key] !== undefined ? mem[key] : null;
        }
        try {
          const r = await window.storage.get(key);
          return r ? r.value : null;
        } catch (e) {
          return null;
        }
      }


      async function stSet(key, value, shared) {
        if (!shared) {
          try {
            localStorage.setItem(key, value);
            return true;
          } catch (e) {
            mem[key] = value;
            return true;
          }
        }
        if (!hasStore) {
          mem[key] = value;
          return true;
        }
        try {
          await window.storage.set(key, value);
          return true;
        } catch (e) {
          console.error("storage set failed", e);
          return false;
        }
      }


      async function stList(prefix, shared) {
        if (!hasStore) {
          return Object.keys(mem).filter((k) => k.startsWith(prefix));
        }
        try {
          const r = await window.storage.list(prefix, !!shared);
          return r ? r.keys : [];
        } catch (e) {
          return [];
        }
      }


      /* ------------------------------------------------------------------ */
      /* Data access                                                         */
      /* ------------------------------------------------------------------ */
      async function loadEvent(id) {
        const raw = await stGet("cp-ev-" + id, true);
        return raw ? JSON.parse(raw) : null;
      }

      async function saveEvent() {
        lastSnapshot = JSON.stringify(ev);
        await stSet("cp-ev-" + evId, lastSnapshot, true);
      }

      /* optimistic: apply locally + render instantly, persist in background */
      let persistChain = Promise.resolve();

      let pendingWrites = 0;

      let lastLocalEdit = 0;

      function persist(fn) {
        pendingWrites++;
        persistChain = persistChain
          .then(async () => {
            const latest = await loadEvent(evId);
            if (latest) {
              fn(latest);
              ev = latest;
            }
            await saveEvent();
          })
          .catch((e) => console.error("persist failed", e))
          .finally(() => {
            pendingWrites--;
          });
      }

      function saveMe(patch) {
        lastLocalEdit = Date.now();
        if (!ev.people[me]) ev.people[me] = {};
        Object.assign(ev.people[me], patch);
        render();
        persist((e) => {
          if (!e.people[me]) e.people[me] = {};
          Object.assign(e.people[me], patch);
        });
      }

      function mutate(fn) {
        lastLocalEdit = Date.now();
        fn(ev);
        render();
        persist(fn);
      }
