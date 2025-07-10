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
      console.log("Rate limit hit. Zendesk API rate limit exceeded.");
      throw new Error(
        "Zendesk API rate limit exceeded. Please wait a few minutes before trying again.",
      );
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
    // Define the specific engineer IDs we want to fetch
    const targetEngineerIds = [
      29215234714775, // Jared Beckler
      29092423638935, // Rahul Joshi
      29092389569431, // Parth Sharma
      24100359866391, // Fernando Duran
      19347232342679, // Alex Bridgeman
      16211207272855, // Sheema Parwaz
      5773445002519, // Manish Sharma
      26396676511767, // Akash Singh
    ];

    console.log(
      `Fetching ${targetEngineerIds.length} specific engineers by ID`,
    );

    // Fetch each engineer individually by ID
    const userPromises = targetEngineerIds.map(async (userId) => {
      try {
        console.log(`Fetching user ID: ${userId}`);
        const userData = await proxyZendeskRequest(`/users/${userId}.json`);
        return userData.user;
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error.message);
        return null; // Return null for failed requests
      }
    });

    // Wait for all user requests to complete
    const users = await Promise.all(userPromises);

    // Filter out any null results (failed requests)
    const validUsers = users.filter((user) => user !== null);

    console.log(
      `Successfully fetched ${validUsers.length} out of ${targetEngineerIds.length} engineers`,
    );

    res.json({
      users: validUsers,
      count: validUsers.length,
      next_page: null,
      previous_page: null,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    // Return empty result instead of demo data
    res.json({
      users: [],
      count: 0,
      next_page: null,
      previous_page: null,
    });
  }
});

app.get("/api/zendesk/tickets", async (req, res) => {
  try {
    // Define the specific engineer IDs we want tickets for
    const targetEngineerIds = [
      29215234714775, // Jared Beckler
      29092423638935, // Rahul Joshi
      29092389569431, // Parth Sharma
      24100359866391, // Fernando Duran
      19347232342679, // Alex Bridgeman
      16211207272855, // Sheema Parwaz
      5773445002519, // Manish Sharma
      26396676511767, // Akash Singh
    ];

    console.log(
      `Fetching tickets for ${targetEngineerIds.length} specific engineers`,
    );

    const { start_date, end_date } = req.query;

    // Fetch tickets for each engineer individually
    const ticketPromises = targetEngineerIds.map(async (assigneeId) => {
      try {
        let endpoint = `/tickets.json?assignee=${assigneeId}&per_page=100`;

        if (start_date && end_date) {
          endpoint += `&created>${start_date}&created<${end_date}`;
        }

        console.log(`Fetching tickets for assignee ID: ${assigneeId}`);
        const ticketData = await proxyZendeskRequest(endpoint);
        return ticketData.tickets || [];
      } catch (error) {
        console.error(
          `Error fetching tickets for assignee ${assigneeId}:`,
          error.message,
        );
        return []; // Return empty array for failed requests
      }
    });

    // Wait for all ticket requests to complete
    const ticketArrays = await Promise.all(ticketPromises);

    // Flatten all ticket arrays into one array
    const allTickets = ticketArrays.flat();

    console.log(
      `Successfully fetched ${allTickets.length} tickets for specified engineers`,
    );

    res.json({
      tickets: allTickets,
      count: allTickets.length,
      next_page: null,
      previous_page: null,
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    // Return empty result instead of demo data
    res.json({
      tickets: [],
      count: 0,
      next_page: null,
      previous_page: null,
    });
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
    // Return empty result instead of demo data
    res.json({
      satisfaction_ratings: [],
      count: 0,
      next_page: null,
      previous_page: null,
    });
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

// Debug endpoint to test Zendesk API directly
app.get("/api/test-zendesk", async (req, res) => {
  try {
    console.log("Testing Zendesk API directly...");
    const response = await fetch(
      "https://builderio.zendesk.com/api/v2/users/me.json",
      {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
      },
    );

    const responseText = await response.text();
    console.log(`Zendesk API test response:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText,
    });

    res.json({
      status: response.status,
      statusText: response.statusText,
      body: responseText,
      success: response.ok,
    });
  } catch (error) {
    console.error("Zendesk API test failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// Demo endpoints removed - no fallback data per user requirements

app.listen(PORT, () => {
  console.log(`Zendesk proxy server running on port ${PORT}`);
});
