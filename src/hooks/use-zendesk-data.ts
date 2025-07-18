import { useState, useEffect, useCallback } from "react";
import { EngineerMetrics, DateRange, AlertItem } from "../lib/types";
import {
  fetchAllEngineerMetrics,
  calculateTeamAverages,
} from "../lib/zendesk-api";

// Check if we're in a cloud environment where localhost isn't available
const isCloudEnvironment = () => {
  const hostname = window.location.hostname;
  const isCloud = hostname !== "localhost" && hostname !== "127.0.0.1";
  console.log("🌐 Environment check:", { hostname, isCloud });
  // Temporarily disable cloud check to allow data loading in Builder.io environment
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

      // In cloud environments, don't attempt API calls - the API will handle fallback to mock data
      if (isCloudEnvironment()) {
        console.warn(
          "Cloud environment detected - backend may not be available, but API will handle fallback",
        );
        // Continue with API calls - fetchAllEngineerMetrics will handle the fallback to mock data
      }

      try {
        const startDate = dateRange?.start;
        const endDate = dateRange?.end;
        console.log("📅 Date range:", { startDate, endDate });

        console.log("🚀 Fetching engineer metrics...");
        const engineerMetrics = await fetchAllEngineerMetrics(
          startDate,
          endDate,
        );
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
        console.log("✅ Data fetch completed successfully!");
      } catch (error) {
        console.error("❌ Error fetching Zendesk data:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch data";

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
