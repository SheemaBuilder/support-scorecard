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
    // Build the health check URL based on environment
    let healthUrl: string;
    if (isCloudEnvironment()) {
      healthUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/health`;
    } else {
      healthUrl = "/api/health";
    }

    console.log("Checking backend health at:", healthUrl);
    const response = await fetch(healthUrl);
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
    console.warn("Backend health check failed:", error);
    return false;
  }
}

// Generic API request function to backend proxy
async function apiRequest<T>(
  endpoint: string,
  params?: URLSearchParams,
): Promise<T> {
  const baseUrl = getApiBaseUrl();

  // Construct URL properly - if baseUrl is absolute, don't use window.location.origin
  let url: URL;
  if (baseUrl.startsWith("http")) {
    url = new URL(`${baseUrl}${endpoint}`);
  } else {
    url = new URL(`${baseUrl}${endpoint}`, window.location.origin);
  }

  if (params) {
    url.search = params.toString();
  }

  console.log(`Making API request to: ${url.toString()}`);

  try {
    const response = await fetch(url.toString());

    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, response.headers);

    // Handle different response types
    let responseText: string;
    try {
      responseText = await response.text();
    } catch (streamError) {
      console.error("Failed to read response stream:", streamError);
      throw new Error("Failed to read response from server");
    }

    if (!response.ok) {
      console.error(`API error response:`, responseText);
      throw new Error(
        `API error: ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error(`Expected JSON but got:`, responseText);
      throw new Error(
        `Expected JSON response but got: ${contentType}. Response: ${responseText.substring(0, 200)}...`,
      );
    }

    // Parse the text as JSON since we already read it
    try {
      return JSON.parse(responseText);
    } catch (jsonError) {
      console.error(`Failed to parse JSON:`, responseText.substring(0, 200));
      throw new Error(`Invalid JSON response: ${jsonError}`);
    }
  } catch (error) {
    console.error(`API request failed for ${url.toString()}:`, error);

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
  const response = await apiRequest<ZendeskUsersResponse>("/users");
  return response.users;
}

export async function getTickets(
  startDate?: Date,
  endDate?: Date,
): Promise<ZendeskTicket[]> {
  const params = new URLSearchParams();

  if (startDate && endDate) {
    params.append("start_date", startDate.toISOString());
    params.append("end_date", endDate.toISOString());
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
  // Calculate based on resolution time, customer satisfaction, and ticket handling
  const avgResolutionScore = calculateResolutionScore(tickets);
  const satisfactionScore = calculateSatisfactionScore(ratings);
  const handlingScore = calculateHandlingScore(tickets);

  return (avgResolutionScore + satisfactionScore + handlingScore) / 3;
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
  if (ratings.length === 0) return 3; // Default score

  const goodRatings = ratings.filter(
    (rating) => rating.score === "good",
  ).length;
  const badRatings = ratings.filter((rating) => rating.score === "bad").length;

  if (ratings.length === 0) return 3;

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

// Main data fetching function
export async function fetchAllEngineerMetrics(
  startDate?: Date,
  endDate?: Date,
): Promise<EngineerMetrics[]> {
  try {
    // Check backend health first
    const isBackendHealthy = await checkBackendHealth();
    if (!isBackendHealthy) {
      const errorMsg = isCloudEnvironment()
        ? "Backend server is not available. Please ensure the server is running on port 3001."
        : "Backend server is not available on localhost:3001. Please start the server with 'npm run server'.";
      throw new Error(errorMsg);
    }

    const [users, tickets, ratings] = await Promise.all([
      getUsers(),
      getTickets(startDate, endDate),
      getSatisfactionRatings(startDate, endDate),
    ]);

    return users.map((user) =>
      calculateEngineerMetrics(user, tickets, ratings),
    );
  } catch (error) {
    console.error("Error fetching engineer metrics:", error);

    // Provide helpful error messages based on environment
    if (isCloudEnvironment()) {
      throw new Error(
        "Backend server not available in cloud environment. This demo requires a running backend server for real Zendesk data.",
      );
    } else {
      throw error;
    }
  }
}

export async function calculateTeamAverages(
  engineerMetrics: EngineerMetrics[],
): Promise<EngineerMetrics> {
  if (engineerMetrics.length === 0) {
    throw new Error(
      "No engineer metrics available for team average calculation",
    );
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
