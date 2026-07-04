import { Router } from "express";
import { runAgent } from "../agent/agentLoop";
import { config } from "../config";
import { describeError } from "../utils/errors";

export const agentRouter = Router();

/**
 * POST /api/agent/run
 * body: { message: string, useMcp?: boolean }
 * Tool-calling AI agent demo. Set useMcp=true to have the agent also pull
 * in tools discovered from the standalone MCP server (mcp-server/), proving
 * out real Model Context Protocol integration rather than only local
 * function calling.
 */
agentRouter.post("/run", async (req, res) => {
  const { message, useMcp } = req.body as { message?: string; useMcp?: boolean };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Request body must include a string 'message' field." });
  }

  try {
    const result = await runAgent(message, { useMcp: Boolean(useMcp) });
    res.json({ ...result, mock: config.isMockMode });
  } catch (err) {
    console.error("[agent] error:", err);
    res.status(500).json({ error: `Agent run failed: ${describeError(err)}` });
  }
});
