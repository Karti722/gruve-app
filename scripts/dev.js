#!/usr/bin/env node
/**
 * Runs all services via concurrently's programmatic API (rather than
 * shelling out to its CLI through npx, which mis-parses args on this
 * project's concurrently@8.2.2 install), then automatically runs
 * stop-all.js on Ctrl+C (or normal exit) as a cleanup backstop.
 *
 * concurrently forwards SIGINT to its children, but on Windows their
 * grandchild processes (tsx/next/uvicorn, nested behind npm's own process
 * wrappers) routinely survive anyway, leaving stale servers holding the
 * ports — see stop-all.js. This wrapper makes that cleanup happen for you
 * instead of requiring a separate `npm run stop` afterward.
 */

const concurrently = require("concurrently").default;
const { stopAll } = require("./stop-all");

const { result } = concurrently(
  [
    { command: "npm run dev --prefix backend", name: "BACKEND", prefixColor: "blue" },
    { command: "npm run dev --prefix frontend", name: "FRONTEND", prefixColor: "green" },
    { command: "npm run dev --prefix python-service", name: "PYTHON", prefixColor: "yellow" },
    { command: "npm run build --prefix mcp-server -- --watch", name: "MCP", prefixColor: "magenta" },
  ],
  { prefix: "name" }
);

let cleaningUp = false;
function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  console.log("\nShutting down — cleaning up any lingering service processes...");
  stopAll();
}

result.then(
  () => {
    cleanup();
    process.exit(0);
  },
  () => {
    cleanup();
    process.exit(1);
  }
);
