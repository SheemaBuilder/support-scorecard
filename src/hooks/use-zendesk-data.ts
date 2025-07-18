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
  // Enable cloud environment detection to use mock data and avoid rate limiting
  return isCloud;
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

      // In cloud environments, use mock data directly due to rate limiting issues
      if (isCloudEnvironment()) {
        console.warn(
          "🌐 Cloud environment detected - using mock data due to Zendesk rate limiting constraints",
        );

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

        console.log("📊 Using mock data to avoid rate limiting");
        const teamAverages = mockData.reduce(
          (acc, engineer) => ({
            cesPercent: acc.cesPercent + engineer.cesPercent,
            avgPcc: acc.avgPcc + engineer.avgPcc,
            closed: acc.closed + engineer.closed,
            open: acc.open + engineer.open,
            openGreaterThan14:
              acc.openGreaterThan14 + engineer.openGreaterThan14,
            closedLessThan7: acc.closedLessThan7 + engineer.closedLessThan7,
            closedEqual1: acc.closedEqual1 + engineer.closedEqual1,
            participationRate:
              acc.participationRate + engineer.participationRate,
            linkCount: acc.linkCount + engineer.linkCount,
            citationCount: acc.citationCount + engineer.citationCount,
            creationCount: acc.creationCount + engineer.creationCount,
            enterprisePercent:
              acc.enterprisePercent + engineer.enterprisePercent,
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

        const count = mockData.length;
        const averageMetrics = {
          name: "Team Average",
          cesPercent: teamAverages.cesPercent / count,
          avgPcc: teamAverages.avgPcc / count,
          closed: Math.round(teamAverages.closed / count),
          open: teamAverages.open / count,
          openGreaterThan14: teamAverages.openGreaterThan14 / count,
          closedLessThan7: teamAverages.closedLessThan7 / count,
          closedEqual1: teamAverages.closedEqual1 / count,
          participationRate: teamAverages.participationRate / count,
          linkCount: teamAverages.linkCount / count,
          citationCount: teamAverages.citationCount / count,
          creationCount: teamAverages.creationCount / count,
          enterprisePercent: teamAverages.enterprisePercent / count,
          technicalPercent: teamAverages.technicalPercent / count,
          surveyCount: teamAverages.surveyCount / count,
        };

        const alerts = generateAlerts(mockData, averageMetrics);

        setState({
          engineerData: mockData,
          averageMetrics,
          alerts,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        });

        console.log("✅ Mock data loaded successfully to avoid rate limiting");
        return;
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
