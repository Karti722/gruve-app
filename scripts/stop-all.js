#!/usr/bin/env node
/**
 * Stops every service `npm run dev` starts: backend (:4000), frontend
 * (:3000, or :3001 if 3000 was taken), python-service (:8001), and any
 * lingering mcp-server `tsc --watch` / `concurrently` orchestrator process.
 *
 * This exists because `concurrently`'s child processes (tsx/next/uvicorn,
 * nested a few layers deep through npm's own process wrappers) routinely
 * survive on Windows even after the top-level `npm run dev` process is
 * killed, leaving stale servers holding the ports. Re-running `npm run dev`
 * without cleaning those up fails with address-already-in-use errors.
 *
 * Cross-platform: uses netstat/taskkill on Windows, lsof/kill elsewhere.
 */

const { execSync } = require("child_process");

const PORTS = [3000, 3001, 4000, 8001];
const isWindows = process.platform === "win32";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function killPid(pid) {
  if (isWindows) run(`taskkill /F /T /PID ${pid}`);
  else run(`kill -9 ${pid}`);
}

// Safety check: ports like 3000/8001 are common enough that some unrelated
// app (or, as observed during development, Docker Desktop's own relay
// process) can occasionally be the one holding them. Only kill a PID if it's
// actually a node/python process — never kill blindly by port alone.
function processName(pid) {
  if (isWindows) {
    return run(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`
    ).trim();
  }
  return run(`ps -p ${pid} -o comm=`).trim();
}

function isKillable(pid) {
  const name = processName(pid).toLowerCase();
  return name.includes("node") || name.includes("python");
}

function pidsListeningOnPort(port) {
  if (isWindows) {
    const out = run(`netstat -ano -p TCP`);
    return out
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /LISTENING/i.test(line))
      .filter((line) => (line.split(/\s+/)[1] || "").endsWith(`:${port}`))
      .map((line) => line.split(/\s+/).pop());
  }
  return run(`lsof -ti tcp:${port}`)
    .split("\n")
    .map((l) => l.trim());
}

// Best-effort cleanup for processes that don't hold a port at all: the
// mcp-server compiler watcher, and the dev orchestrator itself (dev.js, or —
// for backward compatibility with orphans from before dev.js existed — a
// raw `concurrently ... "BACKEND,FRONTEND,PYTHON,MCP"` CLI invocation).
//
// The Windows query below also requires Name -eq 'node.exe'. Without that,
// the query self-matches: it shells out through a powershell.exe/cmd.exe
// helper whose own command line contains the very search string we're
// matching on, so every run would "find" (and kill) its own helper process.
// Our real targets are always launched via `node ...`, so this filter both
// fixes the self-match and is a correctness improvement on its own.
function pidsOfLingeringWatchers() {
  if (isWindows) {
    const out = run(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -like '*scripts*dev.js*' -or $_.CommandLine -like '*BACKEND,FRONTEND,PYTHON,MCP*' -or ($_.CommandLine -like '*mcp-server*' -and $_.CommandLine -like '*tsc*')) } | Select-Object -ExpandProperty ProcessId"`
    );
    return out.split("\n").map((l) => l.trim());
  }
  // pgrep excludes its own PID from results by default, so no self-match risk here.
  const a = run(`pgrep -f "scripts/dev.js"`);
  const b = run(`pgrep -f "BACKEND,FRONTEND,PYTHON,MCP"`);
  const c = run(`pgrep -f "mcp-server.*tsc"`);
  return `${a}\n${b}\n${c}`.split("\n").map((l) => l.trim());
}

function stopAll() {
  console.log(`Stopping Gruve demo services (checking ports: ${PORTS.join(", ")})...`);

  const toKill = new Set();
  for (const port of PORTS) {
    for (const pid of pidsListeningOnPort(port)) {
      if (!pid) continue;
      if (isKillable(pid)) {
        toKill.add(pid);
      } else {
        console.log(
          `  skipping PID ${pid} on port ${port} — it's "${processName(pid)}", not a node/python ` +
            `dev server, so it isn't something this app started (leaving it running).`
        );
      }
    }
  }
  // Watcher PIDs are already matched by their exact command line (unique to
  // this project's scripts), so no extra name check is needed for them.
  for (const pid of pidsOfLingeringWatchers()) {
    if (pid) toKill.add(pid);
  }

  if (toKill.size === 0) {
    console.log("Nothing was running.");
    return;
  }

  for (const pid of toKill) {
    console.log(`  stopping process ${pid}`);
    killPid(pid);
  }
  console.log(`Done — stopped ${toKill.size} process(es).`);
}

module.exports = { stopAll };

if (require.main === module) {
  stopAll();
}
