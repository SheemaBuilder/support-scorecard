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
  subdomain:
    process.env.VITE_ZENDESK_SUBDOMAIN || process.env.ZENDESK_SUBDOMAIN,
  email: process.env.VITE_ZENDESK_EMAIL || process.env.ZENDESK_EMAIL,
  apiToken: process.env.VITE_ZENDESK_API_TOKEN || process.env.ZENDESK_TOKEN,
};

// Debug logging
console.log("Zendesk Config:", {
  subdomain: ZENDESK_CONFIG.subdomain,
  email: ZENDESK_CONFIG.email,
  hasToken: !!ZENDESK_CONFIG.apiToken,
  tokenLength: ZENDESK_CONFIG.apiToken?.length,
  tokenPreview: ZENDESK_CONFIG.apiToken?.substring(0, 10) + "...",
});

// Additional debugging for environment variables
console.log("Environment Variables Check:", {
  VITE_ZENDESK_SUBDOMAIN: process.env.VITE_ZENDESK_SUBDOMAIN,
  VITE_ZENDESK_EMAIL: process.env.VITE_ZENDESK_EMAIL,
  VITE_ZENDESK_API_TOKEN: process.env.VITE_ZENDESK_API_TOKEN
    ? "SET"
    : "NOT SET",
});

const BASE_URL = `https://builderio.zendesk.com/api/v2`;
console.log("Base url is ", BASE_URL);
// Create authentication header
const getAuthHeader = () => {
  const credentials = Buffer.from(
    `${ZENDESK_CONFIG.email}/token:${ZENDESK_CONFIG.apiToken}`,
  ).toString("base64");

  console.log("Auth Debug:", {
    email: ZENDESK_CONFIG.email,
    hasToken: !!ZENDESK_CONFIG.apiToken,
    credentialsLength: credentials.length,
    authHeader: `Basic ${credentials.substring(0, 20)}...`,
  });

  return `Basic ${credentials}`;
};

// Generic proxy function for Zendesk API
async function proxyZendeskRequest(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`Making request to Zendesk API: ${url}`);

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorDetails = "";
    try {
      const errorBody = await response.text();
      errorDetails = ` - Response: ${errorBody}`;
    } catch (e) {
      errorDetails = " - Could not read error response body";
    }

    // Handle rate limiting specifically
    if (response.status === 429) {
      console.log("Rate limit hit, waiting 30 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds for proper rate limit recovery
      console.log("Retrying request after rate limit...");
      return proxyZendeskRequest(endpoint); // Retry once
    }

    throw new Error(
      `Zendesk API error: ${response.status} ${response.statusText}${errorDetails}`,
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

// Add endpoint to fetch individual user by ID
app.get("/api/zendesk/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`Fetching individual user: ${userId}`);
    const data = await proxyZendeskRequest(`/users/${userId}.json`);
    res.json(data);
  } catch (error) {
    console.error(`Error fetching user ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to fetch individual ticket by ID
app.get("/api/zendesk/tickets/:id", async (req, res) => {
  try {
    const ticketId = req.params.id;
    console.log(`Fetching individual ticket: ${ticketId}`);
    const data = await proxyZendeskRequest(`/tickets/${ticketId}.json`);
    res.json(data);
  } catch (error) {
    console.error(`Error fetching ticket ${req.params.id}:`, error);
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
    const params = new URLSearchParams();

    const { start_time, end_time } = req.query;

    // For now, let's try without date filtering to see if the basic endpoint works
    // If start_time and end_time are provided, we'll log them but not use them initially
    if (start_time && end_time) {
      console.log(
        `Date filtering requested: start_time=${start_time}, end_time=${end_time}`,
      );
      console.log(
        `Note: Date filtering temporarily disabled to debug API access`,
      );
      // params.append("start_time", start_time);
      // params.append("end_time", end_time);
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    console.log(`Fetching satisfaction ratings from: ${endpoint}`);
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

// Test endpoint to check auth configuration
app.get("/api/test-auth", (req, res) => {
  const authHeader = getAuthHeader();
  res.json({
    config: {
      subdomain: ZENDESK_CONFIG.subdomain,
      email: ZENDESK_CONFIG.email,
      hasToken: !!ZENDESK_CONFIG.apiToken,
      tokenLength: ZENDESK_CONFIG.apiToken?.length,
    },
    authHeader: authHeader.substring(0, 30) + "...",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint to check Zendesk API connection
app.get("/api/test-zendesk", async (req, res) => {
  try {
    console.log("Testing Zendesk API connection...");

    // Test with a simple API call to get current user
    const data = await proxyZendeskRequest("/users/me.json");

    res.json({
      success: true,
      message: "Successfully connected to Zendesk API",
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Zendesk connection test failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to connect to Zendesk API",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Zendesk proxy server running on port ${PORT}`);
});
