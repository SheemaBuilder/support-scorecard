import { EngineerMetrics } from "./types";

// Backend proxy URL - use relative URLs that Vite will proxy
const getApiBaseUrl = () => {
  // Always use relative URLs - this will work with proxy configuration
  return "/api/zendesk";
};

// Check if we're in a cloud environment where localhost isn't available
const isCloudEnvironment = () => {
  return (
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  );
};

// Check if backend is available
async function checkBackendHealth(): Promise<boolean> {
  try {
    const healthUrl = "/api/health";
    console.log("Checking backend health at:", healthUrl);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        "Health check failed:",
        response.status,
        response.statusText,
      );
      return false;
    }

    const responseText = await response.text();
    const data = JSON.parse(responseText);
    const isHealthy = data.status === "OK";
    console.log("Backend health check result:", isHealthy);
    return isHealthy;
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("Backend health check timed out");
    } else {
      console.warn("Backend health check failed:", error);
    }
    return false;
  }
}

// Generic API request function to backend proxy
async function apiRequest<T>(
  endpoint: string,
  params?: URLSearchParams,
): Promise<T> {
  const baseUrl = getApiBaseUrl();

  // Construct relative URL for proxy
  let urlString = `${baseUrl}${endpoint}`;
  if (params) {
    urlString += `?${params.toString()}`;
  }

  console.log(`🌐 Making API request to: ${urlString}`);
  console.log(`🌐 Base URL: ${baseUrl}, Endpoint: ${endpoint}`);

  try {
    const response = await fetch(url.toString());

    console.log(`📋 Response status: ${response.status}`);
    console.log(
      `📋 Response headers:`,
      Object.fromEntries(response.headers.entries()),
    );

    // Read response text once, regardless of status
    let responseText: string;
    try {
      responseText = await response.text();
    } catch (streamError) {
      console.error("❌ Failed to read response stream:", streamError);
      throw new Error("Failed to read response from server");
    }

    console.log(`📄 Raw response length: ${responseText.length} characters`);
    console.log(`📄 Raw response preview: ${responseText.substring(0, 300)}`);

    // Check if response was not ok AFTER reading the text
    if (!response.ok) {
      console.error(`❌ API error response:`, responseText);
      throw new Error(
        `API error: ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    // Parse as JSON
    try {
      const jsonData = JSON.parse(responseText);
      console.log(`✅ Parsed JSON successfully:`, {
        keys: Object.keys(jsonData),
        dataPreview: jsonData,
      });
      return jsonData;
    } catch (jsonError) {
      console.error(`❌ Failed to parse JSON:`, responseText.substring(0, 500));
      throw new Error(`Invalid JSON response: ${jsonError}`);
    }
  } catch (error) {
    console.error(`❌ API request failed for ${url.toString()}:`, error);

    // Provide more helpful error messages for common issues
    if (
      error instanceof TypeError &&
      error.message.includes("Failed to fetch")
    ) {
      if (isCloudEnvironment()) {
        throw new Error(
          "Cannot connect to backend server in cloud environment. Backend required for real data.",
        );
      } else {
        throw new Error(
          "Cannot connect to backend server. Make sure it's running on port 3001.",
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

// API functions
export async function getUsers(): Promise<ZendeskUser[]> {
  try {
    const response = await apiRequest<ZendeskUsersResponse>("/users");
    console.log("🔍 getUsers() success:", response.users.length, "users");
    return response.users;
  } catch (error) {
    console.warn(
      "Failed to fetch users, returning empty array:",
      error.message,
    );
    return [];
  }
}

export async function getTickets(
  startDate?: Date,
  endDate?: Date,
): Promise<ZendeskTicket[]> {
  try {
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append("start_date", startDate.toISOString());
      params.append("end_date", endDate.toISOString());
    }

    const response = await apiRequest<ZendeskTicketsResponse>(
      "/tickets",
      params,
    );
    console.log("🔍 getTickets() success:", response.tickets.length, "tickets");
    return response.tickets;
  } catch (error) {
    console.warn(
      "Failed to fetch tickets, returning empty array:",
      error.message,
    );
    return [];
  }
}

export async function getSatisfactionRatings(
  startDate?: Date,
  endDate?: Date,
): Promise<ZendeskSatisfactionRating[]> {
  try {
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append(
        "start_time",
        Math.floor(startDate.getTime() / 1000).toString(),
      );
      params.append(
        "end_time",
        Math.floor(endDate.getTime() / 1000).toString(),
      );
    }

    const response = await apiRequest<ZendeskSatisfactionRatingsResponse>(
      "/satisfaction_ratings",
      params,
    );
    console.log(
      "🔍 getSatisfactionRatings() success:",
      response.satisfaction_ratings.length,
      "ratings",
    );
    return response.satisfaction_ratings;
  } catch (error) {
    console.warn(
      "Failed to fetch satisfaction ratings, returning empty array:",
      error.message,
    );
    return [];
  }
}

// Data transformation functions
export function calculateEngineerMetrics(
  user: ZendeskUser,
  tickets: ZendeskTicket[],
  satisfactionRatings: ZendeskSatisfactionRating[],
): EngineerMetrics {
  const userTickets = tickets.filter(
    (ticket) => ticket.assignee_id === user.id,
  );
  const userRatings = satisfactionRatings.filter(
    (rating) => rating.assignee_id === user.id,
  );

  // Calculate metrics
  const closedTickets = userTickets.filter(
    (ticket) => ticket.status === "closed" || ticket.status === "solved",
  );

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

  // Calculate CES scores from custom field
  const cesStats = calculateCESStats(userTickets);

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
    surveyCount:
      cesStats.cesPercent > 0
        ? userTickets.filter((ticket) =>
            ticket.custom_fields?.find(
              (field) => field.id === 31797439524887 && field.value !== null,
            ),
          ).length
        : 0,
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

function calculateCESStats(userTickets: ZendeskTicket[]) {
  // Get CES scores from custom field 31797439524887
  const CES_FIELD_ID = 31797439524887;

  const cesScores: number[] = [];

  userTickets.forEach((ticket) => {
    const cesField = ticket.custom_fields?.find(
      (field) => field.id === CES_FIELD_ID,
    );
    if (cesField && cesField.value !== null && cesField.value !== undefined) {
      const score =
        typeof cesField.value === "string"
          ? parseFloat(cesField.value)
          : Number(cesField.value);
      if (!isNaN(score) && score >= 1 && score <= 7) {
        cesScores.push(score);
      }
    }
  });

  console.log(
    `🔍 CES calculation: found ${cesScores.length} CES scores in ${userTickets.length} tickets`,
  );
  console.log(`🔍 CES scores:`, cesScores);

  if (cesScores.length === 0) {
    console.log("⚠️ No CES scores found in custom fields, returning 0");
    return { cesPercent: 0 };
  }

  // Calculate percentage of scores that are 5 or above (good scores)
  // Assuming 5-7 are "good" scores on a 1-7 scale
  const goodScores = cesScores.filter((score) => score >= 5).length;
  const cesPercent = (goodScores / cesScores.length) * 100;

  console.log(
    `🔍 CES result: ${goodScores}/${cesScores.length} good scores = ${cesPercent.toFixed(1)}%`,
  );

  return { cesPercent };
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
  // Calculate based on resolution time, customer satisfaction, and ticket handling
  const avgResolutionScore = calculateResolutionScore(tickets);
  const satisfactionScore = calculateSatisfactionScore(ratings);
  const handlingScore = calculateHandlingScore(tickets);

  const quality = (avgResolutionScore + satisfactionScore + handlingScore) / 3;

  // Ensure we return a reasonable value (between 1-5 scale)
  return Math.max(1, Math.min(5, quality));
}

function calculateCommunicationScore(tickets: ZendeskTicket[]): number {
  // Simple heuristic: assume tickets with more updates indicate better communication
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
  if (ratings.length === 0) {
    // Return 0 when no ratings available - no dummy data
    return 0;
  }

  const goodRatings = ratings.filter(
    (rating) => rating.score === "good",
  ).length;
  const badRatings = ratings.filter((rating) => rating.score === "bad").length;

  const score = (goodRatings * 5 + badRatings * 1) / ratings.length;
  return Math.max(1, Math.min(5, score));
}

function calculateTechnicalAccuracy(tickets: ZendeskTicket[]): number {
  if (tickets.length === 0) return 3; // Default score

  // Calculate based on reopened tickets (lower is better for accuracy)
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
  // Score based on how quickly tickets are resolved
  if (tickets.length === 0) return 3;

  const resolvedTickets = tickets.filter((ticket) => ticket.solved_at);
  if (resolvedTickets.length === 0) return 2;

  const avgResolutionTime =
    resolvedTickets.reduce((sum, ticket) => {
      const created = new Date(ticket.created_at);
      const solved = new Date(ticket.solved_at!);
      return (
        sum + (solved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      ); // days
    }, 0) / resolvedTickets.length;

  // Score inversely related to resolution time (faster = better)
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

  // Score based on ticket priority handling and status management
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

  if (totalHighPriority === 0) return 4; // Good score if no high priority tickets

  const handlingRatio = highPriorityHandled / totalHighPriority;
  return Math.max(1, Math.min(5, handlingRatio * 5));
}

// Define the specific engineers we want to show (hardcoded list)
const TARGET_ENGINEERS = new Map([
  ["Jared Beckler", 29215234714775],
  ["Rahul Joshi", 29092423638935],
  ["Parth Sharma", 29092389569431],
  ["Fernando Duran", 24100359866391],
  ["Alex Bridgeman", 19347232342679],
  ["Sheema Parwaz", 16211207272855],
  ["Manish Sharma", 5773445002519],
  ["Akash Singh", 26396676511767],
]);

// Main data fetching function
export async function fetchAllEngineerMetrics(
  startDate?: Date,
  endDate?: Date,
): Promise<EngineerMetrics[]> {
  try {
    console.log("🔄 Fetching engineer metrics from API endpoints");
    console.log("📅 Date range:", { startDate, endDate });

    const [users, tickets, ratings] = await Promise.all([
      getUsers(),
      getTickets(startDate, endDate),
      getSatisfactionRatings(startDate, endDate),
    ]);

    console.log("📦 Raw API data:", {
      usersCount: users.length,
      ticketsCount: tickets.length,
      ratingsCount: ratings.length,
      userSample: users.slice(0, 3).map((u) => ({ id: u.id, name: u.name })),
    });

    // Debug the filtering process
    console.log("🔍 Engineer filtering debug:");
    console.log("  Expected engineers:", Array.from(TARGET_ENGINEERS.keys()));
    console.log(
      "  API returned users:",
      users.map((u) => ({ id: u.id, name: u.name })),
    );

    // Filter users to only include engineers from our hardcoded list
    const filteredUsers = users.filter((user) => {
      const hasName = TARGET_ENGINEERS.has(user.name);
      const hasCorrectId = TARGET_ENGINEERS.get(user.name) === user.id;
      console.log(
        `  ${user.name} (${user.id}): hasName=${hasName}, hasCorrectId=${hasCorrectId}`,
      );
      return hasName && hasCorrectId;
    });

    console.log(
      "👥 Filtered engineers:",
      filteredUsers.map((u) => ({ id: u.id, name: u.name })),
    );

    // If we found engineers in the API, calculate real metrics
    if (filteredUsers.length > 0) {
      const engineerMetrics = filteredUsers.map((user) => {
        console.log(`🔍 Calculating metrics for ${user.name} (ID: ${user.id})`);

        const userTickets = tickets.filter(
          (ticket) => ticket.assignee_id === user.id,
        );
        const userRatings = ratings.filter(
          (rating) => rating.assignee_id === user.id,
        );

        console.log(`📊 ${user.name} raw data:`, {
          ticketsCount: userTickets.length,
          ratingsCount: userRatings.length,
          ticketStatuses: userTickets.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
          }, {}),
          sampleCustomFields: userTickets.slice(0, 2).map((t) => ({
            ticketId: t.id,
            customFields:
              t.custom_fields?.map((cf) => ({ id: cf.id, value: cf.value })) ||
              [],
          })),
        });

        const metrics = calculateEngineerMetrics(user, tickets, ratings);

        console.log(`📈 ${user.name} calculated metrics:`, {
          closed: metrics.closed,
          open: metrics.open,
          cesPercent: metrics.cesPercent,
          surveyCount: metrics.surveyCount,
        });

        return metrics;
      });

      console.log(
        "✅ All engineer metrics calculated:",
        engineerMetrics.length,
      );
      return engineerMetrics;
    } else {
      // If no engineers found in API, return empty array
      console.log("⚠️ No engineers found in API, returning empty array");
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching engineer metrics:", error);

    // On error, return empty array - no dummy data
    console.log("🔄 Returning empty array due to API error");
    return [];
  }
}

export async function calculateTeamAverages(
  engineerMetrics: EngineerMetrics[],
): Promise<EngineerMetrics | null> {
  if (engineerMetrics.length === 0) {
    // Return null when no engineer metrics available - no dummy data
    console.log("⚠️ No engineer metrics available, returning null");
    return null;
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
