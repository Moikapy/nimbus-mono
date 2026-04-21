/**
 * HTTP preset tools — generic utilities for fetching URLs.
 * No domain-specific knowledge. The app controls allowed domains.
 */

import { z } from "zod";
import type { ToolDef, ToolContext } from "../core/types";

export interface HttpToolsConfig {
  /** Allowed domains for fetch. Use ["*"] for unrestricted. */
  allowedDomains?: string[];
  /** Max response size in bytes (default: 1MB) */
  maxResponseSize?: number;
  /** Default headers to send with requests */
  headers?: Record<string, string>;
}

export function httpTools(config: HttpToolsConfig = {}): Record<string, ToolDef> {
  const allowedDomains = config.allowedDomains ?? ["*"];
  const maxSize = config.maxResponseSize ?? 1024 * 1024;
  const defaultHeaders = config.headers ?? {};

  const isAllowed = (url: string): boolean => {
    if (allowedDomains.includes("*")) return true;
    const host = new URL(url).hostname;
    return allowedDomains.some(d => host === d || host.endsWith(`.${d}`));
  };

  return {
    http_fetch: {
      description: "Fetch a URL and return the parsed JSON response. Only allowed domains are permitted.",
      parameters: z.object({
        url: z.string().describe("Full URL to fetch (must include http:// or https://)"),
        method: z.enum(["GET", "POST"]).default("GET").describe("HTTP method"),
        body: z.record(z.string(), z.unknown()).optional().describe("JSON body for POST requests"),
      }),
      execute: async (params, ctx) => {
        const { url, method, body } = params as { url: string; method: string; body?: Record<string, unknown> };

        if (!isAllowed(url)) {
          throw new Error(`Domain not allowed: ${new URL(url).hostname}. Allowed: ${allowedDomains.join(", ")}`);
        }

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", ...defaultHeaders },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        if (text.length > maxSize) {
          throw new Error(`Response too large: ${text.length} bytes (max: ${maxSize})`);
        }

        try {
          return JSON.parse(text);
        } catch {
          return { rawText: text.substring(0, 10000) };
        }
      },
    },
  };
}