/**
 * Nimbus Agent — Worker Entry Point
 *
 * Routes all agent requests to the Durable Object.
 */

import { routeAgentRequest } from "agents";
import { MyAgent } from "./agent";

export { MyAgent };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await routeAgentRequest(request, env);
    if (response) return response;

    const url = new URL(request.url);
    if (url.pathname === "/") {
      return Response.json({
        status: "ok",
        agent: "MyAgent",
        version: "1.0.0",
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
