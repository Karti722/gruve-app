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
 * ports — see stop-all.js. Worse, each of those four children runs through
 * its own cmd.exe wrapper (Windows's default shell for spawning an npm
 * script), and Ctrl+C delivers CTRL_C_EVENT to every process sharing this
 * console at once: every one of those cmd.exe instances pops up its own
 * "Terminate batch job (Y/N)?" prompt and blocks on it. That means
 * `concurrently`'s own `result` promise, which only resolves once every
 * child has actually exited, never resolves on its own, no matter how long
 * you wait, since nothing ever answers those prompts — which is exactly why
 * a single Ctrl+C used to hang until you pressed it again and answered Y.
 * Handling SIGINT directly here, instead of only reacting once `result`
 * settles, means the very first Ctrl+C force-kills the whole tree
 * immediately: `taskkill /F` doesn't care that a process is sitting at an
 * interactive prompt, so there's nothing left for you to answer.
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

// Fires on the first Ctrl+C, independently of whether `result` below ever
// settles on its own. `stopAll()` finds and force-kills processes by port
// and command-line match (see stop-all.js), not by waiting on any child to
// cooperate, so it works even while every cmd.exe wrapper is still sitting
// at its own unanswered termination prompt.
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

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
