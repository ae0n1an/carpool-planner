// server.ts
const kv = await Deno.openKv();

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1. Serve the frontend HTML app
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const html = await Deno.readTextFile("./index.html"); // Assumes your file is named index.html
      return new Response(html, { headers: { "content-type": "text/html" } });
    } catch {
      return new Response("index.html not found", { status: 404 });
    }
  }

  // 2. API Endpoint for Deno KV Storage
  if (url.pathname === "/api/storage" && req.method === "POST") {
    try {
      const body = await req.json();
      const { action, key, value, prefix } = body;

      // Ensure keys are treated as safe arrays for Deno KV mapping
      const kvKey = Array.isArray(key) ? key : [key];
      const kvPrefix = Array.isArray(prefix) ? prefix : [prefix];

      if (action === "get") {
        const entry = await kv.get(kvKey);
        return Response.json({ value: entry.value });
      }

      if (action === "set") {
        await kv.set(kvKey, value);
        return Response.json({ success: true });
      }

      if (action === "list") {
        const iter = kv.list({ prefix: kvPrefix });
        const keys = [];
        for await (const res of iter) {
          // Return just the last part of the key matching your frontend logic
          keys.push(res.key[res.key.length - 1]);
        }
        return Response.json({ keys });
      }
    } catch (err) {
      return new Response(err.message, { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
