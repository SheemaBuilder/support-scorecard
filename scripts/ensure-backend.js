#!/usr/bin/env node

const { spawn } = require("child_process");
const fetch = require("node-fetch");
const path = require("path");

async function checkBackend() {
  try {
    const response = await fetch("http://localhost:3001/api/health");
    const data = await response.json();
    return data.status === "OK";
  } catch (error) {
    return false;
  }
}

async function startBackend() {
  const isRunning = await checkBackend();

  if (isRunning) {
    console.log("✅ Backend server is already running on port 3001");
    return;
  }

  console.log("🚀 Starting backend server...");

  const serverProcess = spawn("node", ["index.js"], {
    cwd: path.join(__dirname, "..", "server"),
    stdio: "inherit",
    detached: true,
  });

  // Give the server a moment to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const isNowRunning = await checkBackend();
  if (isNowRunning) {
    console.log("✅ Backend server started successfully");
    process.exit(0);
  } else {
    console.error("❌ Failed to start backend server");
    process.exit(1);
  }
}

startBackend().catch((error) => {
  console.error("Error starting backend:", error);
  process.exit(1);
});
