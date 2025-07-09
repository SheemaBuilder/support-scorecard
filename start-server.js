#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

console.log("Starting Zendesk Proxy Server...");

const serverProcess = spawn("node", ["index.js"], {
  cwd: path.join(__dirname, "server"),
  stdio: "inherit",
});

serverProcess.on("close", (code) => {
  console.log(`Server process exited with code ${code}`);
});

serverProcess.on("error", (err) => {
  console.error("Failed to start server:", err);
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  serverProcess.kill("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  serverProcess.kill("SIGTERM");
  process.exit(0);
});
