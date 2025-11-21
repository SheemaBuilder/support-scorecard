import { useState, useEffect, useCallback } from "react";
import { EngineerMetrics, DateRange, AlertItem } from "../lib/types";

// Mock data generator
function generateMockData(): {
  engineerData: EngineerMetrics[];
  averageMetrics: EngineerMetrics;
} {
  const mockEngineers = [
    {
      name: "Sarah Johnson",
      cesBase: 85,
      surveyBase: 45,
      closedBase: 28,
      openBase: 8,
    },
    {
      name: "Michael Chen",
      cesBase: 92,
      surveyBase: 52,
      closedBase: 35,
      openBase: 5,
    },
    {
      name: "Emily Rodriguez",
      cesBase: 78,
      surveyBase: 38,
      closedBase: 22,
      openBase: 12,
    },
    {
      name: "David Kim",
      cesBase: 88,
      surveyBase: 48,
      closedBase: 31,
      openBase: 7,
    },
    {
      name: "Jessica Martinez",
      cesBase: 95,
      surveyBase: 55,
      closedBase: 38,
      openBase: 4,
    },
    {
      name: "Alex Thompson",
      cesBase: 82,
      surveyBase: 42,
      closedBase: 26,
      openBase: 9,
    },
    {
      name: "Olivia Brown",
      cesBase: 91,
      surveyBase: 50,
      closedBase: 33,
      openBase: 6,
    },
    {
      name: "James Wilson",
      cesBase: 76,
      surveyBase: 36,
      closedBase: 20,
      openBase: 14,
    },
    {
      name: "Emma Davis",
      cesBase: 89,
      surveyBase: 47,
      closedBase: 30,
      openBase: 8,
    },
    {
      name: "Ryan Lee",
      cesBase: 84,
      surveyBase: 44,
      closedBase: 27,
      openBase: 10,
    },
  ];

  const engineerData: EngineerMetrics[] = mockEngineers.map((engineer) => ({
    name: engineer.name,
    cesPercent: engineer.cesBase + Math.random() * 5 - 2.5,
    surveyCount: engineer.surveyBase + Math.floor(Math.random() * 10 - 5),
    closed: engineer.closedBase + Math.floor(Math.random() * 6 - 3),
    open: engineer.openBase + Math.floor(Math.random() * 4 - 2),
    avgPcc: 12.5 + Math.random() * 8,
    participationRate: 3.5 + Math.random() * 1.5,
    citationCount: Math.floor(Math.random() * 8),
    creationCount: Math.floor(Math.random() * 6),
    linkCount: Math.floor(Math.random() * 10),
    enterprisePercent: 20 + Math.random() * 30,
    technicalPercent: 60 + Math.random() * 35,
    closedEqual1: 45 + Math.random() * 20,
    closedLessThan7: 75 + Math.random() * 15,
    openGreaterThan14: Math.floor(Math.random() * 6),
  }));

  const averageMetrics: EngineerMetrics = {
    name: "Team Average",
    cesPercent:
      engineerData.reduce((sum, eng) => sum + eng.cesPercent, 0) /
      engineerData.length,
    surveyCount:
      engineerData.reduce((sum, eng) => sum + eng.surveyCount, 0) /
      engineerData.length,
    closed: Math.round(
      engineerData.reduce((sum, eng) => sum + eng.closed, 0) /
        engineerData.length,
    ),
    open:
      engineerData.reduce((sum, eng) => sum + eng.open, 0) /
      engineerData.length,
    avgPcc:
      engineerData.reduce((sum, eng) => sum + eng.avgPcc, 0) /
      engineerData.length,
    participationRate:
      engineerData.reduce((sum, eng) => sum + eng.participationRate, 0) /
      engineerData.length,
    citationCount:
      engineerData.reduce((sum, eng) => sum + eng.citationCount, 0) /
      engineerData.length,
    creationCount:
      engineerData.reduce((sum, eng) => sum + eng.creationCount, 0) /
      engineerData.length,
    linkCount:
      engineerData.reduce((sum, eng) => sum + eng.linkCount, 0) /
      engineerData.length,
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
    openGreaterThan14:
      engineerData.reduce((sum, eng) => sum + eng.openGreaterThan14, 0) /
      engineerData.length,
  };

  return { engineerData, averageMetrics };
}

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
      console.log("🎭 Loading mock data...", { dateRange });
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await new Promise((resolve) => setTimeout(resolve, 500));

      const { engineerData, averageMetrics } = generateMockData();
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

      console.log("✅ Mock data loaded successfully:", {
        engineerCount: engineerData.length,
        alertCount: alerts.length,
        averageCES: averageMetrics.cesPercent.toFixed(1) + "%",
      });
    },
    [generateAlerts],
  );

  const syncData = useCallback(async (): Promise<SyncResult> => {
    console.log("🎭 Mock sync - refreshing data...");

    setState((prev) => ({ ...prev, isSyncing: true }));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { engineerData, averageMetrics } = generateMockData();
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

    return {
      success: true,
      engineersProcessed: engineerData.length,
      ticketsProcessed: engineerData.reduce(
        (sum, eng) => sum + eng.surveyCount,
        0,
      ),
      metricsCalculated: engineerData.length,
      errors: [],
      duration: 1000,
    };
  }, [generateAlerts]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    console.log("🎭 Initializing with mock data...");
    fetchDataFromDatabase(initialDateRange);
  }, [fetchDataFromDatabase, initialDateRange]);

  return {
    ...state,
    refetch: fetchDataFromDatabase,
    syncData,
    clearError,
  };
}

export function useSupabaseConfig() {
  return {
    isConfigured: true,
    config: {
      hasSupabaseUrl: true,
      hasSupabaseKey: true,
    },
  };
}
