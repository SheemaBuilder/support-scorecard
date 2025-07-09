const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Zendesk API configuration
const ZENDESK_CONFIG = {
  subdomain: process.env.VITE_ZENDESK_SUBDOMAIN,
  email: process.env.VITE_ZENDESK_EMAIL,
  apiToken: process.env.VITE_ZENDESK_API_TOKEN,
};

const BASE_URL = `https://${ZENDESK_CONFIG.subdomain}.zendesk.com/api/v2`;

// Create authentication header
const getAuthHeader = () => {
  const credentials = Buffer.from(
    `${ZENDESK_CONFIG.email}/token:${ZENDESK_CONFIG.apiToken}`,
  ).toString("base64");
  return `Basic ${credentials}`;
};

// Generic proxy function for Zendesk API
async function proxyZendeskRequest(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Zendesk API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// API Routes
app.get("/api/zendesk/users", async (req, res) => {
  try {
    const data = await proxyZendeskRequest("/users.json?role=agent");
    res.json(data);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/zendesk/tickets", async (req, res) => {
  try {
    let endpoint = "/tickets.json?include=users";

    const { start_date, end_date } = req.query;
    if (start_date && end_date) {
      endpoint += `&created>${start_date}&created<${end_date}`;
    }

    const data = await proxyZendeskRequest(endpoint);
    res.json(data);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/zendesk/satisfaction_ratings", async (req, res) => {
  try {
    let endpoint = "/satisfaction_ratings.json";

    const { start_time, end_time } = req.query;
    if (start_time && end_time) {
      endpoint += `?start_time=${start_time}&end_time=${end_time}`;
    }

    const data = await proxyZendeskRequest(endpoint);
    res.json(data);
  } catch (error) {
    console.error("Error fetching satisfaction ratings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Zendesk proxy server running on port ${PORT}`);
});
