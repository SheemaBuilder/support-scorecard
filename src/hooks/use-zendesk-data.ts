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
      console.log("🔄 fetchData called with dateRange:", dateRange);
      console.log("🔄 Starting data fetch...", {
        dateRange,
      });
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check circuit breaker first
      if (shouldUseCircuitBreaker()) {
        throw new Error(
          "Rate limit protection active. Please wait 2 minutes before trying again.",
        );
      }

      // Emergency timeout to prevent endless loading
      const emergencyTimeout = setTimeout(() => {
        console.log("🚨 Emergency timeout triggered - stopping loading state");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Request timed out. Click 'Pull Data' to try again.",
        }));
      }, 30000); // 30 second emergency timeout

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
        // Clear emergency timeout on success
        clearTimeout(emergencyTimeout);

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
          errorMessage.includes("Rate limit active") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("429")
        ) {
          consecutiveFailures++;
          lastFailureTime = Date.now();
          console.log(
            `🚫 Rate limit failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`,
          );
        }

        // Clear emergency timeout on error
        clearTimeout(emergencyTimeout);

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
    console.log(
      "🚀 useZendeskData useEffect triggered with initialDateRange:",
      initialDateRange,
    );
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
