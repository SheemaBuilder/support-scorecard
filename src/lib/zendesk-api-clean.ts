import { EngineerMetrics } from "./types";
import { nameToIdMap } from "./engineerMap.js";
import { getBulkUsers } from "./bulk-users.js";

// Backend proxy URL - always use relative URLs for Vite proxy
const getApiBaseUrl = () => {
  console.log("🔄 Using relative URLs for API requests");
  return "/api/zendesk";
};

// Check if backend is available
async function checkBackendHealth(): Promise<boolean> {
  try {
    console.log("🏥 Checking backend health...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("/api/health", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        "❌ Backend health check failed - response not ok:",
        response.status,
      );
      return false;
    }

    const responseText = await response.text();
    const data = JSON.parse(responseText);
    const isHealthy = data.status === "OK";
    console.log(
      isHealthy ? "✅ Backend is healthy" : "❌ Backend is not healthy",
    );
    return isHealthy;
  } catch (error) {
    console.warn("❌ Backend health check failed with error:", error);
    return false;
  }
}

// Generic API request function to backend proxy
async function apiRequest<T>(
  endpoint: string,
  params?: URLSearchParams,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let url: URL;
  
  if (baseUrl.startsWith("http")) {
    url = new URL(`${baseUrl}${endpoint}`);
  } else {
    url = new URL(`${baseUrl}${endpoint}`, window.location.origin);
  }

  if (params) {
    url.search = params.toString();
  }

  const requestId = Math.random().toString(36).substring(7);
  const urlString = url.toString();
  console.log(`🌐 [${requestId}] Making API request to: ${urlString}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(urlString, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const status = response.status;
    const statusText = response.statusText;
    console.log(`📊 [${requestId}] Response status: ${status} ${statusText}`);

    // Read response text
    const responseText = await response.text();
    console.log(`📄 [${requestId}] Raw response length: ${responseText.length} characters`);

    // Check if response was not ok
    if (status < 200 || status >= 300) {
      console.error(`❌ [${requestId}] API error response:`, responseText);

      // Handle specific backend errors
      if (responseText.includes("Rate limit protection active") || responseText.includes("API rate limit exceeded")) {
        throw new Error(responseText);
      }

      // Provide user-friendly error messages
      let userFriendlyMessage = '';
      if (status === 500) {
        userFriendlyMessage = 'Backend server error. The Zendesk API proxy is having issues.';
      } else if (status === 404) {
        userFriendlyMessage = 'API endpoint not found. Backend server may not be running.';
      } else if (status >= 400 && status < 500) {
        userFriendlyMessage = 'Client error. Check API configuration.';
      } else {
        userFriendlyMessage = `Server returned ${status} ${statusText}`;
      }

      throw new Error(`${userFriendlyMessage} (${status})`);
    }

    // Parse as JSON
    try {
      console.log(`🔄 [${requestId}] Parsing JSON...`);
      const jsonData = JSON.parse(responseText);
      console.log(`✅ [${requestId}] Parsed JSON successfully`);
      return jsonData;
    } catch (jsonError) {
      console.error(`❌ [${requestId}] Failed to parse JSON:`, responseText.substring(0, 500));
      throw new Error(`[${requestId}] Invalid JSON response: ${jsonError}`);
    }
  } catch (error) {
    console.error(`🚨 [${requestId}] API request failed for ${urlString}:`, error);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Request timeout after 2 minutes (likely due to rate limits): ${urlString}`,
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("Rate limit protection active")) {
        const waitMatch = error.message.match(/(\d+) seconds/);
        const waitTime = waitMatch ? waitMatch[1] : "2-3 minutes";
        throw new Error(
          `Rate limit active. Please wait ${waitTime} seconds before trying again.`,
        );
      }

      if (error.message.includes("Failed to fetch")) {
        throw new Error(
          "Network connection issue. Please wait 30 seconds and try 'Pull Data' again.",
        );
      }
    }

    throw error;
  }
}

// Zendesk API types
interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ZendeskTicket {
  id: number;
  subject: string;
  status: "new" | "open" | "pending" | "hold" | "solved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  type: "problem" | "incident" | "question" | "task";
  assignee_id: number | null;
  requester_id: number;
  submitter_id: number;
  created_at: string;
  updated_at: string;
  solved_at: string | null;
  tags: string[];
  custom_fields: Array<{
    id: number;
    value: string | number | boolean | null;
  }>;
}

interface ZendeskUsersResponse {
  users: ZendeskUser[];
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface ZendeskTicketsResponse {
  tickets: ZendeskTicket[];
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface ZendeskSatisfactionRating {
  id: number;
  score: "offered" | "unoffered" | "received" | "good" | "bad";
  ticket_id: number;
  assignee_id: number;
  requester_id: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface ZendeskSatisfactionRatingsResponse {
  satisfaction_ratings: ZendeskSatisfactionRating[];
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

// API functions - Use bulk fetching to avoid rate limits
export async function getUsers(): Promise<ZendeskUser[]> {
  // Use bulk fetching to avoid rate limits completely
  return await getBulkUsers();
}

export async function getTickets(
  startDate?: Date,
  endDate?: Date,
): Promise<ZendeskTicket[]> {
  const params = new URLSearchParams();

  if (startDate && endDate) {
    params.append("start_date", startDate.toISOString());
    params.append("end_date", endDate.toISOString());
    console.log(
      `🔍 Date filter - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`,
    );
  }

  const response = await apiRequest<ZendeskTicketsResponse>("/tickets", params);
  return response.tickets;
}

export async function getSatisfactionRatings(
  startDate?: Date,
  endDate?: Date,
): Promise<ZendeskSatisfactionRating[]> {
  const params = new URLSearchParams();

  if (startDate && endDate) {
    params.append(
      "start_time",
      Math.floor(startDate.getTime() / 1000).toString(),
    );
    params.append("end_time", Math.floor(endDate.getTime() / 1000).toString());
  }

  const response = await apiRequest<ZendeskSatisfactionRatingsResponse>(
    "/satisfaction_ratings",
    params,
  );
  return response.satisfaction_ratings;
}

// Data transformation functions
export function calculateEngineerMetrics(
  user: ZendeskUser,
  tickets: ZendeskTicket[],
  satisfactionRatings: ZendeskSatisfactionRating[],
  startDate?: Date,
  endDate?: Date,
): EngineerMetrics {
  const userTickets = tickets.filter(
    (ticket) => ticket.assignee_id === user.id,
  );
  const userRatings = satisfactionRatings.filter(
    (rating) => rating.assignee_id === user.id,
  );

  // Calculate metrics with proper date filtering for solved tickets
  let closedTickets = userTickets.filter(
    (ticket) => ticket.status === "closed" || ticket.status === "solved",
  );

  // Apply date filtering based on when tickets were actually solved
  if (startDate && endDate) {
    console.log(
      `🔍 Filtering ${user.name}'s closed tickets by solved date: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const originalCount = closedTickets.length;
    closedTickets = closedTickets.filter((ticket) => {
      const solvedDate = ticket.solved_at
        ? new Date(ticket.solved_at)
        : new Date(ticket.updated_at);
      const isInRange = solvedDate >= startDate && solvedDate <= endDate;
      return isInRange;
    });

    console.log(
      `📊 ${user.name}: ${originalCount} total closed → ${closedTickets.length} in date range`,
    );
  }

  const openTickets = userTickets.filter(
    (ticket) =>
      ticket.status === "new" ||
      ticket.status === "open" ||
      ticket.status === "pending",
  );

  // Calculate response times
  const avgPcc = calculateAverageResponseTime(userTickets);

  // Calculate closure times
  const closureStats = calculateClosureStats(closedTickets);

  // Calculate satisfaction scores
  const cesStats = calculateCESStats(userRatings);

  // Calculate technical percentages from tags
  const technicalStats = calculateTechnicalStats(userTickets);

  return {
    name: user.name,
    cesPercent: cesStats.cesPercent,
    avgPcc: avgPcc,
    closed: closedTickets.length,
    open: openTickets.length,
    openGreaterThan14: calculateOpenGreaterThan14Days(openTickets),
    closedLessThan7: closureStats.closedLessThan7Percent,
    closedEqual1: closureStats.closedEqual1Percent,
    participationRate: calculateOverallQuality(userTickets, userRatings),
    linkCount: calculateCommunicationScore(userTickets),
    citationCount: calculateResponseQuality(userTickets, userRatings),
    creationCount: calculateTechnicalAccuracy(userTickets),
    enterprisePercent: technicalStats.enterprisePercent,
    technicalPercent: technicalStats.technicalPercent,
    surveyCount: userRatings.length,
  };
}

// Helper functions for metric calculations
function calculateAverageResponseTime(tickets: ZendeskTicket[]): number {
  if (tickets.length === 0) return 0;

  const responseTimes = tickets.map((ticket) => {
    const created = new Date(ticket.created_at);
    const updated = new Date(ticket.updated_at);
    return (updated.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
  });

  return (
    responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
  );
}

function calculateClosureStats(closedTickets: ZendeskTicket[]) {
  if (closedTickets.length === 0) {
    return { closedLessThan7Percent: 0, closedEqual1Percent: 0 };
  }

  let closedLessThan7 = 0;
  let closedEqual1 = 0;

  closedTickets.forEach((ticket) => {
    if (ticket.solved_at) {
      const created = new Date(ticket.created_at);
      const solved = new Date(ticket.solved_at);
      const daysDiff =
        (solved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 7) closedLessThan7++;
      if (daysDiff <= 1) closedEqual1++;
    }
  });

  return {
    closedLessThan7Percent: (closedLessThan7 / closedTickets.length) * 100,
    closedEqual1Percent: (closedEqual1 / closedTickets.length) * 100,
  };
}

function calculateCESStats(ratings: ZendeskSatisfactionRating[]) {
  if (ratings.length === 0) return { cesPercent: 0 };

  const goodRatings = ratings.filter(
    (rating) => rating.score === "good",
  ).length;
  return {
    cesPercent: (goodRatings / ratings.length) * 100,
  };
}

function calculateOpenGreaterThan14Days(openTickets: ZendeskTicket[]): number {
  const now = new Date();
  return openTickets.filter((ticket) => {
    const created = new Date(ticket.created_at);
    const daysDiff =
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 14;
  }).length;
}

function calculateTechnicalStats(tickets: ZendeskTicket[]) {
  if (tickets.length === 0) {
    return { enterprisePercent: 0, technicalPercent: 0 };
  }

  const enterpriseTickets = tickets.filter((ticket) =>
    ticket.tags.some((tag) => tag.toLowerCase().includes("enterprise")),
  ).length;

  const technicalTickets = tickets.filter((ticket) =>
    ticket.tags.some((tag) =>
      ["technical", "api", "integration", "development", "bug"].some(
        (keyword) => tag.toLowerCase().includes(keyword),
      ),
    ),
  ).length;

  return {
    enterprisePercent: (enterpriseTickets / tickets.length) * 100,
    technicalPercent: (technicalTickets / tickets.length) * 100,
  };
}

function calculateOverallQuality(
  tickets: ZendeskTicket[],
  ratings: ZendeskSatisfactionRating[],
): number {
  const avgResolutionScore = calculateResolutionScore(tickets);
  const satisfactionScore = calculateSatisfactionScore(ratings);
  const handlingScore = calculateHandlingScore(tickets);

  return (avgResolutionScore + satisfactionScore + handlingScore) / 3;
}

function calculateCommunicationScore(tickets: ZendeskTicket[]): number {
  if (tickets.length === 0) return 0;

  const avgUpdates =
    tickets.reduce((sum, ticket) => {
      const created = new Date(ticket.created_at);
      const updated = new Date(ticket.updated_at);
      const timeDiff = updated.getTime() - created.getTime();
      return sum + (timeDiff > 0 ? 1 : 0);
    }, 0) / tickets.length;

  return Math.min(5, Math.max(1, avgUpdates));
}

function calculateResponseQuality(
  tickets: ZendeskTicket[],
  ratings: ZendeskSatisfactionRating[],
): number {
  if (ratings.length === 0) return 3;

  const goodRatings = ratings.filter(
    (rating) => rating.score === "good",
  ).length;
  const badRatings = ratings.filter((rating) => rating.score === "bad").length;

  if (ratings.length === 0) return 3;

  const score = (goodRatings * 5 + badRatings * 1) / ratings.length;
  return Math.max(1, Math.min(5, score));
}

function calculateTechnicalAccuracy(tickets: ZendeskTicket[]): number {
  if (tickets.length === 0) return 3;

  const totalTickets = tickets.length;
  const closedThenReopened = tickets.filter((ticket) => {
    return (
      ticket.status === "open" &&
      new Date(ticket.updated_at) > new Date(ticket.created_at)
    );
  }).length;

  const accuracy = 1 - closedThenReopened / totalTickets;
  return Math.max(1, Math.min(5, accuracy * 5));
}

function calculateResolutionScore(tickets: ZendeskTicket[]): number {
  if (tickets.length === 0) return 3;

  const resolvedTickets = tickets.filter((ticket) => ticket.solved_at);
  if (resolvedTickets.length === 0) return 2;

  const avgResolutionTime =
    resolvedTickets.reduce((sum, ticket) => {
      const created = new Date(ticket.created_at);
      const solved = new Date(ticket.solved_at!);
      return (
        sum + (solved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      );
    }, 0) / resolvedTickets.length;

  if (avgResolutionTime <= 1) return 5;
  if (avgResolutionTime <= 3) return 4;
  if (avgResolutionTime <= 7) return 3;
  if (avgResolutionTime <= 14) return 2;
  return 1;
}

function calculateSatisfactionScore(
  ratings: ZendeskSatisfactionRating[],
): number {
  if (ratings.length === 0) return 3;

  const goodRatings = ratings.filter(
    (rating) => rating.score === "good",
  ).length;
  const totalRatings = ratings.length;

  return Math.max(1, Math.min(5, (goodRatings / totalRatings) * 5));
}

function calculateHandlingScore(tickets: ZendeskTicket[]): number {
  if (tickets.length === 0) return 3;

  const highPriorityHandled = tickets
    .filter(
      (ticket) => ticket.priority === "high" || ticket.priority === "urgent",
    )
    .filter(
      (ticket) => ticket.status === "solved" || ticket.status === "closed",
    ).length;

  const totalHighPriority = tickets.filter(
    (ticket) => ticket.priority === "high" || ticket.priority === "urgent",
  ).length;

  if (totalHighPriority === 0) return 4;

  const handlingRatio = highPriorityHandled / totalHighPriority;
  return Math.max(1, Math.min(5, handlingRatio * 5));
}

// Main data fetching function with sequential requests to avoid rate limits
export async function fetchAllEngineerMetrics(
  startDate?: Date,
  endDate?: Date,
): Promise<EngineerMetrics[]> {
  console.log("🚀 Starting fetchAllEngineerMetrics...");

  try {
    console.log("✅ Attempting to fetch real Zendesk data with sequential requests...");
    
    // Make requests SEQUENTIALLY to avoid overwhelming the API
    console.log("🧑‍💻 Step 1: Fetching users...");
    const users = await getUsers();
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("🎫 Step 2: Fetching tickets...");
    const tickets = await getTickets(startDate, endDate);
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("⭐ Step 3: Fetching satisfaction ratings...");
    const ratings = await getSatisfactionRatings(startDate, endDate);

    console.log("📊 Raw data received:");
    console.log("- Engineers:", users.length);
    console.log("- Tickets:", tickets.length);
    console.log("- Ratings:", ratings.length);

    if (users.length === 0) {
      console.error("❌ No engineers found from API");
      throw new Error("No engineers found in API response");
    }

    const engineerMetrics = users.map((user) =>
      calculateEngineerMetrics(user, tickets, ratings, startDate, endDate),
    );

    console.log("📈 Generated metrics for:", engineerMetrics.map((e) => e.name));
    return engineerMetrics;
  } catch (error) {
    console.error("❌ Failed to fetch real data:", error);
    throw error;
  }
}

export async function calculateTeamAverages(
  engineerMetrics: EngineerMetrics[],
): Promise<EngineerMetrics> {
  console.log("📊 Calculating team averages for", engineerMetrics.length, "engineers");

  if (engineerMetrics.length === 0) {
    throw new Error("No engineer metrics available for team average calculation");
  }

  const averages = engineerMetrics.reduce(
    (acc, engineer) => ({
      cesPercent: acc.cesPercent + engineer.cesPercent,
      avgPcc: acc.avgPcc + engineer.avgPcc,
      closed: acc.closed + engineer.closed,
      open: acc.open + engineer.open,
      openGreaterThan14: acc.openGreaterThan14 + engineer.openGreaterThan14,
      closedLessThan7: acc.closedLessThan7 + engineer.closedLessThan7,
      closedEqual1: acc.closedEqual1 + engineer.closedEqual1,
      participationRate: acc.participationRate + engineer.participationRate,
      linkCount: acc.linkCount + engineer.linkCount,
      citationCount: acc.citationCount + engineer.citationCount,
      creationCount: acc.creationCount + engineer.creationCount,
      enterprisePercent: acc.enterprisePercent + engineer.enterprisePercent,
      technicalPercent: acc.technicalPercent + engineer.technicalPercent,
      surveyCount: acc.surveyCount + engineer.surveyCount,
    }),
    {
      cesPercent: 0,
      avgPcc: 0,
      closed: 0,
      open: 0,
      openGreaterThan14: 0,
      closedLessThan7: 0,
      closedEqual1: 0,
      participationRate: 0,
      linkCount: 0,
      citationCount: 0,
      creationCount: 0,
      enterprisePercent: 0,
      technicalPercent: 0,
      surveyCount: 0,
    },
  );

  const count = engineerMetrics.length;

  return {
    name: "Team Average",
    cesPercent: averages.cesPercent / count,
    avgPcc: averages.avgPcc / count,
    closed: Math.round(averages.closed / count),
    open: averages.open / count,
    openGreaterThan14: averages.openGreaterThan14 / count,
    closedLessThan7: averages.closedLessThan7 / count,
    closedEqual1: averages.closedEqual1 / count,
    participationRate: averages.participationRate / count,
    linkCount: averages.linkCount / count,
    citationCount: averages.citationCount / count,
    creationCount: averages.creationCount / count,
    enterprisePercent: averages.enterprisePercent / count,
    technicalPercent: averages.technicalPercent / count,
    surveyCount: averages.surveyCount / count,
  };
}
