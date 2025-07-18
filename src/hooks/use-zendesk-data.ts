import { useState, useEffect, useCallback } from "react";
import { EngineerMetrics, DateRange, AlertItem } from "../lib/types";
import {
  fetchAllEngineerMetrics,
  calculateTeamAverages,
} from "../lib/zendesk-api";

// Rate limiting state management
let lastFailureTime: number | null = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_BREAKER_DURATION = 120000; // 2 minutes

// Check if we should use circuit breaker
const shouldUseCircuitBreaker = () => {
  const now = Date.now();
  if (lastFailureTime && consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    if (now - lastFailureTime < CIRCUIT_BREAKER_DURATION) {
      console.log(
        `🚫 Circuit breaker active: ${Math.round((CIRCUIT_BREAKER_DURATION - (now - lastFailureTime)) / 1000)}s remaining`,
      );
      return true;
    } else {
      // Reset circuit breaker
      lastFailureTime = null;
      consecutiveFailures = 0;
      console.log("✅ Circuit breaker reset");
    }
  }
  return false;
};

interface UseZendeskDataState {
  engineerData: EngineerMetrics[];
  averageMetrics: EngineerMetrics | null;
  alerts: AlertItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface UseZendeskDataReturn extends UseZendeskDataState {
  refetch: (dateRange?: DateRange) => Promise<void>;
  clearError: () => void;
}

export function useZendeskData(
  initialDateRange?: DateRange,
): UseZendeskDataReturn {
  const [state, setState] = useState<UseZendeskDataState>({
    engineerData: [],
    averageMetrics: null,
    alerts: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const generateAlerts = useCallback(
    (engineerData: EngineerMetrics[], averageMetrics: EngineerMetrics) => {
      const alerts: AlertItem[] = [];

      // Check for engineers with CES below 75%
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

      // Check for engineers with high open ticket count
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

      // Check for engineers with tickets open longer than 14 days
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

      // Check for low participation rates
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

  const fetchData = useCallback(
    async (dateRange?: DateRange) => {
      console.log("🔄 Starting data fetch...", {
        dateRange,
        isCloudEnvironment: isCloudEnvironment(),
      });
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check circuit breaker first
      if (shouldUseCircuitBreaker()) {
        throw new Error(
          "Rate limit protection active. Please wait 2 minutes before trying again.",
        );
      }

      // Import mock data directly to avoid rate limiting issues in cloud
      const mockData = [
        {
          name: "Jared Beckler",
          cesPercent: 89.2,
          avgPcc: 3.4,
          closed: 32,
          open: 4,
          openGreaterThan14: 1,
          closedLessThan7: 78.5,
          closedEqual1: 45.2,
          participationRate: 4.2,
          linkCount: 3.8,
          citationCount: 4.1,
          creationCount: 4.3,
          enterprisePercent: 42.0,
          technicalPercent: 58.5,
          surveyCount: 18,
        },
        {
          name: "Rahul Joshi",
          cesPercent: 85.7,
          avgPcc: 2.8,
          closed: 28,
          open: 6,
          openGreaterThan14: 2,
          closedLessThan7: 82.1,
          closedEqual1: 52.3,
          participationRate: 4.0,
          linkCount: 4.2,
          citationCount: 3.9,
          creationCount: 4.1,
          enterprisePercent: 38.5,
          technicalPercent: 65.2,
          surveyCount: 16,
        },
        {
          name: "Parth Sharma",
          cesPercent: 91.3,
          avgPcc: 2.1,
          closed: 35,
          open: 3,
          openGreaterThan14: 0,
          closedLessThan7: 88.9,
          closedEqual1: 62.1,
          participationRate: 4.5,
          linkCount: 4.6,
          citationCount: 4.4,
          creationCount: 4.7,
          enterprisePercent: 45.8,
          technicalPercent: 72.3,
          surveyCount: 21,
        },
        {
          name: "Fernando Duran",
          cesPercent: 83.1,
          avgPcc: 4.2,
          closed: 24,
          open: 7,
          openGreaterThan14: 1,
          closedLessThan7: 75.6,
          closedEqual1: 38.9,
          participationRate: 3.8,
          linkCount: 3.5,
          citationCount: 3.7,
          creationCount: 3.9,
          enterprisePercent: 35.2,
          technicalPercent: 52.8,
          surveyCount: 14,
        },
        {
          name: "Alex Bridgeman",
          cesPercent: 87.4,
          avgPcc: 3.1,
          closed: 30,
          open: 5,
          openGreaterThan14: 1,
          closedLessThan7: 80.3,
          closedEqual1: 48.7,
          participationRate: 4.1,
          linkCount: 4.0,
          citationCount: 4.0,
          creationCount: 4.2,
          enterprisePercent: 41.7,
          technicalPercent: 61.9,
          surveyCount: 17,
        },
        {
          name: "Sheema Parwaz",
          cesPercent: 93.6,
          avgPcc: 1.9,
          closed: 38,
          open: 2,
          openGreaterThan14: 0,
          closedLessThan7: 92.1,
          closedEqual1: 68.4,
          participationRate: 4.7,
          linkCount: 4.8,
          citationCount: 4.6,
          creationCount: 4.8,
          enterprisePercent: 48.3,
          technicalPercent: 75.6,
          surveyCount: 23,
        },
        {
          name: "Manish Sharma",
          cesPercent: 86.8,
          avgPcc: 2.7,
          closed: 29,
          open: 5,
          openGreaterThan14: 1,
          closedLessThan7: 81.7,
          closedEqual1: 51.2,
          participationRate: 4.1,
          linkCount: 4.1,
          citationCount: 4.0,
          creationCount: 4.3,
          enterprisePercent: 40.1,
          technicalPercent: 63.4,
          surveyCount: 19,
        },
        {
          name: "Akash Singh",
          cesPercent: 84.2,
          avgPcc: 3.6,
          closed: 26,
          open: 6,
          openGreaterThan14: 2,
          closedLessThan7: 76.8,
          closedEqual1: 42.5,
          participationRate: 3.9,
          linkCount: 3.7,
          citationCount: 3.8,
          creationCount: 4.0,
          enterprisePercent: 36.9,
          technicalPercent: 55.7,
          surveyCount: 15,
        },
      ];

      try {
        const startDate = dateRange?.start;
        const endDate = dateRange?.end;
        console.log("📅 Date range:", { startDate, endDate });

        console.log("🚀 Fetching engineer metrics...");

        // Add shorter timeout to prevent endless loading
        const timeoutPromise = new Promise(
          (_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Request timeout - API may be rate limited. Try again in 2 minutes.",
                  ),
                ),
              60000,
            ), // 1 minute timeout
        );

        const engineerMetrics = (await Promise.race([
          fetchAllEngineerMetrics(startDate, endDate),
          timeoutPromise,
        ])) as any;
        console.log(
          "👥 Engineer metrics received:",
          engineerMetrics.length,
          "engineers",
        );

        console.log("📊 Calculating team averages...");
        const teamAverages = await calculateTeamAverages(engineerMetrics);
        console.log("📈 Team averages calculated:", teamAverages);

        console.log("🚨 Generating alerts...");
        const alerts = generateAlerts(engineerMetrics, teamAverages);
        console.log("🔔 Alerts generated:", alerts.length, "alerts");

        setState({
          engineerData: engineerMetrics,
          averageMetrics: teamAverages,
          alerts,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        });
        // Reset failure counter on success
        consecutiveFailures = 0;
        lastFailureTime = null;
        console.log("✅ Data fetch completed successfully!");
      } catch (error) {
        console.error("❌ Error fetching Zendesk data:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch data";

        // Track consecutive failures for circuit breaker
        if (
          errorMessage.includes("rate limit") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("429")
        ) {
          consecutiveFailures++;
          lastFailureTime = Date.now();
          console.log(
            `🚫 Rate limit failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`,
          );
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          engineerData: [],
          averageMetrics: null,
          alerts: [],
        }));
        console.log("🔄 Set error state:", errorMessage);
      }
    },
    [generateAlerts],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData(initialDateRange);
  }, [fetchData, initialDateRange]);

  return {
    ...state,
    refetch: fetchData,
    clearError,
  };
}

// Hook for checking API configuration
export function useZendeskConfig() {
  const subdomain = import.meta.env.VITE_ZENDESK_SUBDOMAIN;
  const email = import.meta.env.VITE_ZENDESK_EMAIL;
  const apiToken = import.meta.env.VITE_ZENDESK_API_TOKEN;

  const isConfigured = Boolean(subdomain && email && apiToken);

  return {
    isConfigured,
    config: {
      subdomain,
      email,
      hasApiToken: Boolean(apiToken),
    },
  };
}
