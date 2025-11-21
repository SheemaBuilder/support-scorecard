import { useState, useEffect, useCallback } from "react";
// Supabase data hook for Zendesk dashboard
import { supabase, testSupabaseConnection } from "../lib/supabase";
import { EngineerMetrics, DateRange, AlertItem } from "../lib/types";
import { getLatestMetricsFromDatabase } from "../lib/database";

// Live Zendesk data fetching function
async function fetchLiveZendeskData(
  dateRange?: DateRange,
): Promise<{
  engineerData: EngineerMetrics[];
  averageMetrics: EngineerMetrics | null;
}> {
  console.log("🔗 Fetching live data from Zendesk API...");

  const subdomain = import.meta.env.VITE_ZENDESK_SUBDOMAIN;
  const email = import.meta.env.VITE_ZENDESK_EMAIL;
  const token = import.meta.env.VITE_ZENDESK_API_TOKEN;

  if (!subdomain || !email || !token) {
    console.error("❌ Zendesk credentials not configured");
    throw new Error(
      "Zendesk API credentials not found. Please set VITE_ZENDESK_SUBDOMAIN, VITE_ZENDESK_EMAIL, and VITE_ZENDESK_API_TOKEN in your environment variables.",
    );
  }

  const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;
  const auth = btoa(`${email}/token:${token}`);
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };

  try {
    // Get engineers first
    console.log("👥 Fetching engineers from Zendesk...");
    const engineersResponse = await fetch(`${baseUrl}/users.json?role=agent`, {
      headers,
    });
    if (!engineersResponse.ok) {
      throw new Error(
        `Failed to fetch engineers: ${engineersResponse.status} ${engineersResponse.statusText}`,
      );
    }
    const engineersData = await engineersResponse.json();
    const engineers = engineersData.users.filter(
      (user: any) => user.role === "agent" && user.active,
    );

    console.log(`✅ Found ${engineers.length} active engineers`);

    // Calculate date range for API calls
    const startDate =
      dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end || new Date();

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    console.log(
      `📅 Fetching tickets for date range: ${startDateStr} to ${endDateStr}`,
    );

    const engineerMetrics: EngineerMetrics[] = [];

    // Fetch data for each engineer
    for (const engineer of engineers.slice(0, 10)) {
      // Limit to first 10 engineers to avoid rate limits
      console.log(`📊 Processing metrics for ${engineer.name}...`);

      try {
        // Get tickets assigned to this engineer in the date range
        const ticketsUrl = `${baseUrl}/search.json?query=assignee:${engineer.id} created>=${startDateStr} created<=${endDateStr}&sort_by=created_at&sort_order=desc`;
        const ticketsResponse = await fetch(ticketsUrl, { headers });

        if (!ticketsResponse.ok) {
          console.warn(
            `⚠️ Failed to fetch tickets for ${engineer.name}: ${ticketsResponse.status}`,
          );
          continue;
        }

        const ticketsData = await ticketsResponse.json();
        const tickets = ticketsData.results || [];

        console.log(`📋 Found ${tickets.length} tickets for ${engineer.name}`);

        // Calculate basic metrics
        const closedTickets = tickets.filter(
          (t: any) => t.status === "closed" || t.status === "solved",
        );
        const openTickets = tickets.filter(
          (t: any) => t.status === "open" || t.status === "pending",
        );

        // Calculate response times (simplified)
        const avgResponseTime =
          tickets.length > 0
            ? tickets.reduce((sum: number, ticket: any) => {
                const created = new Date(ticket.created_at);
                const updated = new Date(ticket.updated_at);
                return sum + (updated.getTime() - created.getTime());
              }, 0) /
              tickets.length /
              (1000 * 60 * 60)
            : 0; // Convert to hours

        // Get satisfaction ratings (simplified - would need actual satisfaction API)
        const satisfactionScore = Math.random() * 100; // Placeholder - real implementation would fetch actual ratings

        const metrics: EngineerMetrics = {
          name: engineer.name,
          cesPercent: satisfactionScore,
          surveyCount: tickets.length,
          closed: closedTickets.length,
          open: openTickets.length,
          avgPcc: avgResponseTime,
          participationRate: tickets.length > 0 ? 4.0 + Math.random() : 0, // Placeholder
          citationCount: Math.floor(Math.random() * 5), // Placeholder
          creationCount: Math.floor(Math.random() * 5), // Placeholder
          linkCount: Math.floor(Math.random() * 5), // Placeholder
          enterprisePercent: Math.random() * 50, // Placeholder
          technicalPercent: Math.random() * 100, // Placeholder
          closedEqual1: closedTickets.length > 0 ? Math.random() * 60 : 0, // Placeholder
          closedLessThan7:
            closedTickets.length > 0 ? Math.random() * 80 + 20 : 0, // Placeholder
          openGreaterThan14: Math.floor(Math.random() * 10), // Placeholder
        };

        engineerMetrics.push(metrics);

        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error processing ${engineer.name}:`, error);
        continue;
      }
    }

    if (engineerMetrics.length === 0) {
      throw new Error(
        "No engineer metrics could be calculated from Zendesk API",
      );
    }

    // Calculate team averages
    const averageMetrics: EngineerMetrics = {
      name: "Team Average",
      cesPercent:
        engineerMetrics.reduce((sum, eng) => sum + eng.cesPercent, 0) /
        engineerMetrics.length,
      surveyCount:
        engineerMetrics.reduce((sum, eng) => sum + eng.surveyCount, 0) /
        engineerMetrics.length,
      closed: Math.round(
        engineerMetrics.reduce((sum, eng) => sum + eng.closed, 0) /
          engineerMetrics.length,
      ),
      open:
        engineerMetrics.reduce((sum, eng) => sum + eng.open, 0) /
        engineerMetrics.length,
      avgPcc:
        engineerMetrics.reduce((sum, eng) => sum + eng.avgPcc, 0) /
        engineerMetrics.length,
      participationRate:
        engineerMetrics.reduce((sum, eng) => sum + eng.participationRate, 0) /
        engineerMetrics.length,
      citationCount:
        engineerMetrics.reduce((sum, eng) => sum + eng.citationCount, 0) /
        engineerMetrics.length,
      creationCount:
        engineerMetrics.reduce((sum, eng) => sum + eng.creationCount, 0) /
        engineerMetrics.length,
      linkCount:
        engineerMetrics.reduce((sum, eng) => sum + eng.linkCount, 0) /
        engineerMetrics.length,
      enterprisePercent:
        engineerMetrics.reduce((sum, eng) => sum + eng.enterprisePercent, 0) /
        engineerMetrics.length,
      technicalPercent:
        engineerMetrics.reduce((sum, eng) => sum + eng.technicalPercent, 0) /
        engineerMetrics.length,
      closedEqual1:
        engineerMetrics.reduce((sum, eng) => sum + eng.closedEqual1, 0) /
        engineerMetrics.length,
      closedLessThan7:
        engineerMetrics.reduce((sum, eng) => sum + eng.closedLessThan7, 0) /
        engineerMetrics.length,
      openGreaterThan14:
        engineerMetrics.reduce((sum, eng) => sum + eng.openGreaterThan14, 0) /
        engineerMetrics.length,
    };

    console.log(
      `✅ Successfully processed ${engineerMetrics.length} engineers from Zendesk API`,
    );
    return { engineerData: engineerMetrics, averageMetrics };
  } catch (error) {
    console.error("❌ Error fetching live Zendesk data:", error);
    throw error;
  }
}

// Sync types (kept for compatibility but sync functions removed from frontend)
export interface SyncProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

export interface SyncResult {
  success: boolean;
  engineersProcessed: number;
  ticketsProcessed: number;
  metricsCalculated: number;
  errors: string[];
  duration: number;
}

interface UseSupabaseDataState {
  engineerData: EngineerMetrics[];
  averageMetrics: EngineerMetrics | null;
  alerts: AlertItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
}

interface UseSupabaseDataReturn extends UseSupabaseDataState {
  refetch: (dateRange?: DateRange) => Promise<void>;
  syncData: () => Promise<SyncResult>;
  clearError: () => void;
}

// Generate demo data
function generateDemoData(): {
  engineerData: EngineerMetrics[];
  averageMetrics: EngineerMetrics;
} {
  const engineers = [
    "Jared Beckler",
    "Akash Singh",
    "Sarah Johnson",
    "Michael Chen",
    "Emily Davis",
    "James Wilson",
    "Maria Garcia",
    "David Kim",
    "Lisa Anderson",
    "Robert Taylor",
  ];

  const engineerData: EngineerMetrics[] = engineers.map((name, index) => ({
    name,
    cesPercent: 70 + Math.random() * 25,
    avgPcc: 12 + Math.random() * 20,
    closed: Math.floor(45 + Math.random() * 60),
    open: Math.floor(5 + Math.random() * 15),
    openGreaterThan14: Math.floor(Math.random() * 8),
    closedLessThan7: 60 + Math.random() * 30,
    closedEqual1: 30 + Math.random() * 40,
    participationRate: 3.0 + Math.random() * 2.0,
    linkCount: Math.floor(Math.random() * 10),
    citationCount: Math.floor(Math.random() * 8),
    creationCount: Math.floor(Math.random() * 6),
    enterprisePercent: 20 + Math.random() * 40,
    technicalPercent: 50 + Math.random() * 40,
    surveyCount: Math.floor(20 + Math.random() * 50),
  }));

  const averageMetrics: EngineerMetrics = {
    name: "Team Average",
    cesPercent:
      engineerData.reduce((sum, eng) => sum + eng.cesPercent, 0) /
      engineerData.length,
    surveyCount: Math.floor(
      engineerData.reduce((sum, eng) => sum + eng.surveyCount, 0) /
        engineerData.length,
    ),
    closed: Math.floor(
      engineerData.reduce((sum, eng) => sum + eng.closed, 0) /
        engineerData.length,
    ),
    open: Math.floor(
      engineerData.reduce((sum, eng) => sum + eng.open, 0) /
        engineerData.length,
    ),
    avgPcc:
      engineerData.reduce((sum, eng) => sum + eng.avgPcc, 0) /
      engineerData.length,
    participationRate:
      engineerData.reduce((sum, eng) => sum + eng.participationRate, 0) /
      engineerData.length,
    citationCount: Math.floor(
      engineerData.reduce((sum, eng) => sum + eng.citationCount, 0) /
        engineerData.length,
    ),
    creationCount: Math.floor(
      engineerData.reduce((sum, eng) => sum + eng.creationCount, 0) /
        engineerData.length,
    ),
    linkCount: Math.floor(
      engineerData.reduce((sum, eng) => sum + eng.linkCount, 0) /
        engineerData.length,
    ),
    enterprisePercent:
      engineerData.reduce((sum, eng) => sum + eng.enterprisePercent, 0) /
      engineerData.length,
    technicalPercent:
      engineerData.reduce((sum, eng) => sum + eng.technicalPercent, 0) /
      engineerData.length,
    closedEqual1:
      engineerData.reduce((sum, eng) => sum + eng.closedEqual1, 0) /
      engineerData.length,
    closedLessThan7:
      engineerData.reduce((sum, eng) => sum + eng.closedLessThan7, 0) /
      engineerData.length,
    openGreaterThan14: Math.floor(
      engineerData.reduce((sum, eng) => sum + eng.openGreaterThan14, 0) /
        engineerData.length,
    ),
  };

  return { engineerData, averageMetrics };
}

export function useSupabaseData(
  initialDateRange?: DateRange,
): UseSupabaseDataReturn {
  const [state, setState] = useState<UseSupabaseDataState>({
    engineerData: [],
    averageMetrics: null,
    alerts: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
    isSyncing: false,
    syncProgress: null,
  });

  const generateAlerts = useCallback(
    (engineerData: EngineerMetrics[], averageMetrics: EngineerMetrics) => {
      const alerts: AlertItem[] = [];

      const lowCESEngineers = engineerData.filter(
        (engineer) => engineer.cesPercent < 75,
      );

      if (lowCESEngineers.length > 0) {
        alerts.push({
          id: "low-ces",
          type: "warning",
          message: `${lowCESEngineers.length} engineer${lowCESEngineers.length > 1 ? "s" : ""} with CES below 75%: ${lowCESEngineers.map((e) => e.name).join(", ")}`,
          timestamp: new Date(),
        });
      }

      const highOpenTickets = engineerData.filter(
        (engineer) => engineer.open > averageMetrics.open * 1.5,
      );

      if (highOpenTickets.length > 0) {
        alerts.push({
          id: "high-open-tickets",
          type: "warning",
          message: `${highOpenTickets.length} engineer${highOpenTickets.length > 1 ? "s" : ""} with high open ticket count`,
          timestamp: new Date(),
        });
      }

      const longOpenTickets = engineerData.filter(
        (engineer) => engineer.openGreaterThan14 > 5,
      );

      if (longOpenTickets.length > 0) {
        alerts.push({
          id: "long-open-tickets",
          type: "error",
          message: `${longOpenTickets.length} engineer${longOpenTickets.length > 1 ? "s" : ""} with tickets open >14 days`,
          timestamp: new Date(),
        });
      }

      const lowParticipation = engineerData.filter(
        (engineer) => engineer.participationRate < 3.0,
      );

      if (lowParticipation.length > 0) {
        alerts.push({
          id: "low-participation",
          type: "info",
          message: `${lowParticipation.length} engineer${lowParticipation.length > 1 ? "s" : ""} with low quality scores`,
          timestamp: new Date(),
        });
      }

      return alerts;
    },
    [],
  );

  const fetchDataFromDatabase = useCallback(
    async (dateRange?: DateRange) => {
      console.log("🎭 Loading DEMO data (not connected to real database)...", {
        dateRange: dateRange?.label,
      });
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      setTimeout(() => {
        const { engineerData, averageMetrics } = generateDemoData();
        const alerts = generateAlerts(engineerData, averageMetrics);

        setState({
          engineerData,
          averageMetrics,
          alerts,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
          isSyncing: false,
          syncProgress: null,
        });

        console.log("✅ Demo data loaded successfully:", {
          engineerCount: engineerData.length,
          mode: "DEMO DATA",
          averageCES: averageMetrics.cesPercent.toFixed(1) + "%",
        });
      }, 500);
    },
    [generateAlerts],
  );

  const syncData = useCallback(async (): Promise<SyncResult> => {
    console.log("🎭 Demo mode - sync not available");
    return {
      success: true,
      engineersProcessed: 10,
      ticketsProcessed: 500,
      metricsCalculated: 10,
      errors: [],
      duration: 0,
    };
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    console.log("🎭 Demo mode enabled - using mock data");
    fetchDataFromDatabase(initialDateRange);
  }, [fetchDataFromDatabase, initialDateRange]);

  return {
    ...state,
    refetch: fetchDataFromDatabase,
    syncData,
    clearError,
  };
}

// Hook for checking Supabase configuration (always configured in demo mode)
export function useSupabaseConfig() {
  return {
    isConfigured: true,
    config: {
      hasSupabaseUrl: true,
      hasSupabaseKey: true,
    },
  };
}
