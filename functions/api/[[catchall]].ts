interface Env {
  BACKEND_URL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.BACKEND_URL) {
    return new Response(
      JSON.stringify({ error: "BACKEND_URL is not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const incomingUrl = new URL(request.url);
  const backendBaseUrl = env.BACKEND_URL.replace(/\/+$/, "");

  const targetUrl = new URL(
    `${backendBaseUrl}${incomingUrl.pathname}${incomingUrl.search}`
  );

  const headers = new Headers(request.headers);
  headers.set("Host", targetUrl.host);
  headers.set(
    "X-Forwarded-Host",
    request.headers.get("Host") || incomingUrl.host
  );
  headers.set(
    "X-Forwarded-Proto",
    incomingUrl.protocol.replace(":", "")
  );

  const clientIp = request.headers.get("CF-Connecting-IP");

  if (clientIp) {
    headers.set("X-Forwarded-For", clientIp);
  }

  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });

  try {
    return await fetch(proxyRequest);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Bad Gateway",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
