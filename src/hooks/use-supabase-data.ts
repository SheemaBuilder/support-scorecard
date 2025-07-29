import { useState, useEffect, useCallback } from "react";
// Supabase data hook for Zendesk dashboard
import { supabase, testSupabaseConnection } from "../lib/supabase";
import { EngineerMetrics, DateRange, AlertItem } from "../lib/types";
import { getLatestMetricsFromDatabase } from "../lib/database";

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

  const fetchDataFromDatabase = useCallback(
    async (dateRange?: DateRange) => {
      console.log('🚀 Starting fetchDataFromDatabase...', {
        dateRange: dateRange ? {
          label: dateRange.label,
          value: dateRange.value,
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString()
        } : null
      });
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        console.log('📊 About to call getLatestMetricsFromDatabase...');

        const startDate = dateRange?.start;
        const endDate = dateRange?.end;

        console.log("🔄 Fetching engineer metrics from database with date range:", {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          dateRange: dateRange ? {
            label: dateRange.label,
            value: dateRange.value,
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString()
          } : null
        });

        const { engineerData, averageMetrics } = await getLatestMetricsFromDatabase(startDate, endDate);

        console.log("📊 Database metrics:", {
          engineerDataCount: engineerData?.length || 0,
          hasAverageMetrics: !!averageMetrics,
          sampleEngineer: engineerData?.[0]
        });

        if (!averageMetrics || engineerData.length === 0) {
          console.log('📋 No metrics found in database');
          setState({
            engineerData: [],
            averageMetrics: null,
            alerts: [],
            isLoading: false,
            error: 'No data available for the selected period',
            lastUpdated: new Date(),
            isSyncing: false,
            syncProgress: null,
          });
          return;
        }

        const alerts = generateAlerts(engineerData, averageMetrics);
        console.log("🚨 Generated alerts:", alerts);

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

        console.log("✅ Successfully loaded data from database:", {
          engineerCount: engineerData.length,
          hasAverages: !!averageMetrics,
          alertCount: alerts.length,
          dateRange: dateRange ? dateRange.label : 'No date filter'
        });
      } catch (error) {
        console.error("❌ Error fetching data from database:", error);
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('❌ Error details:', {
          message: errorMessage,
          type: typeof error,
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });

        // Provide more user-friendly error messages
        let userFriendlyError = "Failed to fetch data";
        if (errorMessage.includes('Failed to fetch')) {
          userFriendlyError = "Unable to connect to database. Please check your internet connection and try again.";
        } else if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
          userFriendlyError = "Connection timeout. The database may be temporarily unavailable.";
        } else if (errorMessage.includes('CORS')) {
          userFriendlyError = "Database access denied. Please check configuration.";
        } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
          userFriendlyError = "Database authentication failed. Please check credentials.";
        }

        setState({
          engineerData: [],
          averageMetrics: null,
          alerts: [],
          isLoading: false,
          error: userFriendlyError,
          lastUpdated: null,
          isSyncing: false,
          syncProgress: null,
        });
      }
    },
    [generateAlerts],
  );

  const syncData = useCallback(async (): Promise<SyncResult> => {
    console.log('⚠️ Frontend sync disabled - use CLI sync script instead');

    setState((prev) => ({
      ...prev,
      error: 'Frontend sync is disabled. Run in terminal: npm run sync:incremental'
    }));

    return {
      success: false,
      engineersProcessed: 0,
      ticketsProcessed: 0,
      metricsCalculated: 0,
      errors: ['Frontend sync disabled - use CLI: npm run sync:incremental'],
      duration: 0
    };
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Initial data fetch from database
  useEffect(() => {
    console.log('🚀 Initial useEffect triggered, fetching data...', { initialDateRange });
    fetchDataFromDatabase(initialDateRange);
  }, [fetchDataFromDatabase, initialDateRange]);

  return {
    ...state,
    refetch: fetchDataFromDatabase,
    syncData,
    clearError,
  };
}

// Hook for checking Supabase configuration
export function useSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  return {
    isConfigured,
    config: {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseKey: Boolean(supabaseAnonKey),
    },
  };
}
