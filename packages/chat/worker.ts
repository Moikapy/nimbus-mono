/**
 * 0xNIMBUS — Chat Static Worker
 * Serves the static Next.js export.
 */

import { getAssetFromKV } from "@cloudflare/kv-asset-handler";

export interface Env {
  __STATIC_CONTENT: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const page = await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: (env as any).__STATIC_CONTENT_MANIFEST,
        }
      );
      return new Response(page.body, page);
    } catch (e) {
      try {
        const fallback = await getAssetFromKV(
          {
            request: new Request(new URL("/index.html", request.url)),
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: (env as any).__STATIC_CONTENT_MANIFEST,
          }
        );
        return new Response(fallback.body, { ...fallback, status: 200 });
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    }
  },
};
