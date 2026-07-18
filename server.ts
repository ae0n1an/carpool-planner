// server.ts
let kv;
try {
  kv = await Deno.openKv();
} catch (e) {
  console.error("Failed to initialize Deno KV:", e);
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

  // Fallback check if KV database failed to load entirely
  if (url.pathname.startsWith("/api/storage") && !kv) {
    return new Response(JSON.stringify({ error: "Database initialization failed on host." }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  // 1. Serve frontend app
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { "content-type": "text/html", ...corsHeaders } });
    } catch {
      return new Response("index.html not found", { status: 404, headers: corsHeaders });
    }
  }

  // 2. Storage API Endpoint
  if (url.pathname === "/api/storage" && req.method === "POST") {
    try {
      const body = await req.json();
      const { action, key, value, prefix } = body;

      const kvKey = Array.isArray(key) ? key : [key];
      const kvPrefix = Array.isArray(prefix) ? prefix : [prefix];

      if (action === "get") {
        const entry = await kv.get(kvKey);
        return new Response(JSON.stringify({ value: entry.value }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      if (action === "set") {
        await kv.set(kvKey, value);
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      if (action === "list") {
        const iter = kv.list({ prefix: kvPrefix });
        const keys = [];
        for await (const res of iter) {
          keys.push(res.key[res.key.length - 1]);
        }
        return new Response(JSON.stringify({ keys }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
});
