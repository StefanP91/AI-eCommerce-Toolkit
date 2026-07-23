/**
 * Reverse-proxy Shopify traffic to Render.
 * When Render is cold, return a branded loader (never the marketing site,
 * never Render's "WELCOME TO RENDER" page in Admin).
 */
const ORIGIN = "https://ai-ecommerce-shopify-app.onrender.com";

const WAKING_RE =
  /SERVICE WAKING UP|ALLOCATING COMPUTE RESOURCES|INCOMING HTTP REQUEST DETECTED|WELCOME TO RENDER/i;

export default async (request, context) => {
  const incoming = new URL(request.url);

  // Let Netlify internals alone.
  if (incoming.pathname.startsWith("/.netlify")) {
    return context.next();
  }

  const target = new URL(incoming.pathname + incoming.search, ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("accept-encoding", "identity");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-for", request.headers.get("x-forwarded-for") || "");

  /** @type {RequestInit} */
  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), init);
  } catch {
    return loaderResponse();
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      const out = new Headers(upstream.headers);
      out.set("location", rewriteAbsoluteUrl(location, incoming.origin));
      out.delete("content-encoding");
      out.delete("content-length");
      return new Response(null, { status: upstream.status, headers: out });
    }
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const text = await upstream.text();
    if (WAKING_RE.test(text) || upstream.status >= 502) {
      return loaderResponse();
    }
    return new Response(text, {
      status: upstream.status,
      headers: sanitizeHeaders(upstream.headers),
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: sanitizeHeaders(upstream.headers),
  });
};

function sanitizeHeaders(source) {
  const headers = new Headers(source);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return headers;
}

function rewriteAbsoluteUrl(location, publicOrigin) {
  try {
    const url = new URL(location, ORIGIN);
    if (url.hostname.endsWith("onrender.com")) {
      return publicOrigin + url.pathname + url.search + url.hash;
    }
    return location;
  } catch {
    return location;
  }
}

function loaderResponse() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Commerce Suite</title>
  <style>
    :root { --bg:#070d1a; --card:#141f35; --text:#e8edf7; --muted:#8b9bb8; --accent:#863bff; --blue:#47bfff; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; min-height: 100%;
      background:
        radial-gradient(circle at top right, rgba(71,191,255,.1), transparent 40%),
        radial-gradient(circle at 15% 80%, rgba(134,59,255,.14), transparent 35%),
        var(--bg);
      color: var(--text);
      font-family: "Segoe UI", system-ui, sans-serif;
    }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; }
    .card {
      width: min(420px, 100%); background: var(--card);
      border: 1px solid rgba(126,20,255,.22); border-radius: 16px;
      padding: 1.5rem 1.35rem; text-align: center;
    }
    h1 { margin: 0 0 .4rem; font-size: 1.15rem; }
    p { margin: 0; color: var(--muted); font-size: .92rem; line-height: 1.45; }
    .spinner {
      width: 34px; height: 34px; margin: 1.15rem auto .85rem; border-radius: 50%;
      border: 3px solid rgba(255,255,255,.12);
      border-top-color: var(--accent); border-right-color: var(--blue);
      animation: spin .85s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hint { margin-top: .75rem; font-size: .8rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>AI Commerce Suite</h1>
      <p style="margin-bottom:.35rem;font-size:.85rem">Starting your workspace</p>
      <div class="spinner" aria-hidden="true"></div>
      <p id="status">Waking the app server…</p>
      <p class="hint">This can take up to a minute after idle time.</p>
    </div>
  </div>
  <script>
    (function () {
      var n = 0;
      var status = document.getElementById("status");
      function tick() {
        n += 1;
        if (n > 2) status.textContent = "Still starting — almost there…";
        // Same URL (keeps shop/host). Edge proxy serves the real app when ready.
        window.location.reload();
      }
      setTimeout(tick, 2200);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
