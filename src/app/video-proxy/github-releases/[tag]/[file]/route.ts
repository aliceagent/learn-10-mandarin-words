import { githubReleaseAssetUrl, proxyVideoResponseHeaders } from "@/lib/video-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ tag: string; file: string }> | { tag: string; file: string };
};

async function proxyReleaseVideo(request: Request, context: RouteContext): Promise<Response> {
  const { tag, file } = await context.params;
  const upstreamUrl = githubReleaseAssetUrl(tag, file);
  if (!upstreamUrl) return new Response("Invalid video asset", { status: 400 });

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    redirect: "follow",
    cache: "no-store",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Video unavailable", { status: upstream.status });
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: proxyVideoResponseHeaders(upstream),
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return proxyReleaseVideo(request, context);
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return proxyReleaseVideo(request, context);
}
