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
    // Define the specific engineers we want to show
    const targetEngineers = new Map([
      ["Jared Beckler", 29215234714775],
      ["Rahul Joshi", 29092423638935],
      ["Parth Sharma", 29092389569431],
      ["Fernando Duran", 24100359866391],
      ["Alex Bridgeman", 19347232342679],
      ["Sheema Parwaz", 16211207272855],
      ["Manish Sharma", 5773445002519],
      ["Akash Singh", 26396676511767],
    ]);

    // Try to get all users
    const allUsersData = await proxyZendeskRequest("/users.json?per_page=100");

    // Filter to only include engineers from our nameToIdMap
    const filteredUsers = allUsersData.users.filter(
      (user) =>
        targetEngineers.has(user.name) &&
        targetEngineers.get(user.name) === user.id,
    );

    res.json({
      users: filteredUsers,
      count: filteredUsers.length,
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
    // Start with a simpler request
    let endpoint = "/tickets.json?per_page=100";

    const { start_date, end_date } = req.query;
    if (start_date && end_date) {
      endpoint += `&created>${start_date}&created<${end_date}`;
    }

    const data = await proxyZendeskRequest(endpoint);
    res.json(data);
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

    // Fall back to demo data for any error (auth issues, rate limiting, etc.)
    console.log("Falling back to demo data due to API error:", error.message);
    return res.redirect("/api/zendesk-demo/satisfaction_ratings");
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

// Demo data endpoints for when API is rate-limited
app.get("/api/zendesk-demo/users", (req, res) => {
  const demoUsers = {
    users: [
      {
        id: 1,
        name: "Alexander Bridgeman",
        email: "alexander@builder.io",
        role: "agent",
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-12-01T00:00:00Z",
      },
      {
        id: 2,
        name: "Demo Engineer 1",
        email: "engineer1@builder.io",
        role: "agent",
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-12-01T00:00:00Z",
      },
      {
        id: 3,
        name: "Demo Engineer 2",
        email: "engineer2@builder.io",
        role: "agent",
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-12-01T00:00:00Z",
      },
    ],
    count: 3,
    next_page: null,
    previous_page: null,
  };
  res.json(demoUsers);
});

app.get("/api/zendesk-demo/tickets", (req, res) => {
  const demoTickets = {
    tickets: [
      {
        id: 1001,
        subject: "Demo ticket 1",
        status: "solved",
        priority: "normal",
        type: "question",
        assignee_id: 1,
        requester_id: 100,
        submitter_id: 100,
        created_at: "2025-06-15T10:00:00Z",
        updated_at: "2025-06-16T14:00:00Z",
        solved_at: "2025-06-16T14:00:00Z",
        tags: ["support", "general"],
        custom_fields: [],
      },
      {
        id: 1002,
        subject: "Demo ticket 2",
        status: "closed",
        priority: "high",
        type: "problem",
        assignee_id: 2,
        requester_id: 101,
        submitter_id: 101,
        created_at: "2025-06-20T09:00:00Z",
        updated_at: "2025-06-20T17:00:00Z",
        solved_at: "2025-06-20T17:00:00Z",
        tags: ["technical", "api"],
        custom_fields: [],
      },
      {
        id: 1003,
        subject: "Demo ticket 3",
        status: "open",
        priority: "normal",
        type: "question",
        assignee_id: 3,
        requester_id: 102,
        submitter_id: 102,
        created_at: "2025-07-01T08:00:00Z",
        updated_at: "2025-07-01T08:00:00Z",
        solved_at: null,
        tags: ["support"],
        custom_fields: [],
      },
    ],
    count: 3,
    next_page: null,
    previous_page: null,
  };
  res.json(demoTickets);
});

app.get("/api/zendesk-demo/satisfaction_ratings", (req, res) => {
  const demoRatings = {
    satisfaction_ratings: [
      {
        id: 2001,
        score: "good",
        ticket_id: 1001,
        assignee_id: 1,
        requester_id: 100,
        comment: "Great support!",
        created_at: "2025-06-16T15:00:00Z",
        updated_at: "2025-06-16T15:00:00Z",
      },
      {
        id: 2002,
        score: "good",
        ticket_id: 1002,
        assignee_id: 2,
        requester_id: 101,
        comment: "Quick resolution",
        created_at: "2025-06-20T18:00:00Z",
        updated_at: "2025-06-20T18:00:00Z",
      },
    ],
    count: 2,
    next_page: null,
    previous_page: null,
  };
  res.json(demoRatings);
});

app.listen(PORT, () => {
  console.log(`Zendesk proxy server running on port ${PORT}`);
});
