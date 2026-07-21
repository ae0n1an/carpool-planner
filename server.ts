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

// server.ts
let kv: any = null;

async function getKV() {
  if (kv) return kv;
  try {
    kv = await Deno.openKv();
    console.log("Successfully connected to Deno KV cloud instance.");
    return kv;
  } catch (e) {
    // <-- Fixed missing opening brace here
    console.error("Deno KV connection error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Serve frontend app directly from decoded memory string
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(htmlContent, {
      headers: { "content-type": "text/html", ...corsHeaders },
    });
  }

  // 2. Storage API Endpoint
  if (url.pathname === "/api/storage" && req.method === "POST") {
    const database = await getKV();

    if (!database) {
      return new Response(JSON.stringify({ error: "Database unavailable." }), {
        status: 503,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      const body = await req.json();
      const { action, key, value, prefix } = body;

      const kvKey = Array.isArray(key) ? key : [key];
      const kvPrefix = Array.isArray(prefix) ? prefix : [prefix];

      if (action === "get") {
        const entry = await database.get(kvKey);
        return new Response(JSON.stringify({ value: entry.value }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (action === "set") {
        await database.set(kvKey, value);
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (action === "list") {
        const iter = database.list({ prefix: kvPrefix });
        const keys = [];
        for await (const res of iter) {
          keys.push(res.key[res.key.length - 1]);
        }
        return new Response(JSON.stringify({ keys }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
});
