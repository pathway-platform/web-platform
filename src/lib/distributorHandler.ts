export const DISTRIBUTOR_HANDLER_BASE_URL =
  process.env.DISTRIBUTOR_HANDLER_BASE_URL ?? "http://localhost:8001";

export async function proxyDistributorHandler(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = `${DISTRIBUTOR_HANDLER_BASE_URL}${path}`;
  const init: RequestInit = {
    method,
    cache: "no-store",
  };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const upstream = await fetch(url, init);
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
