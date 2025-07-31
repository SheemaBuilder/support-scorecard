import { useState, useEffect, useCallback } from "react";
// Supabase data hook for Zendesk dashboard
import { supabase, testSupabaseConnection } from "../lib/supabase";
import { EngineerMetrics, DateRange, AlertItem } from "../lib/types";
import { getLatestMetricsFromDatabase } from "../lib/database";

// Live Zendesk data fetching function
async function fetchLiveZendeskData(dateRange?: DateRange): Promise<{ engineerData: EngineerMetrics[], averageMetrics: EngineerMetrics | null }> {
  console.log('🔗 Fetching live data from Zendesk API...');

  const subdomain = import.meta.env.VITE_ZENDESK_SUBDOMAIN;
  const email = import.meta.env.VITE_ZENDESK_EMAIL;
  const token = import.meta.env.VITE_ZENDESK_API_TOKEN;

  if (!subdomain || !email || !token) {
    console.error('❌ Zendesk credentials not configured');
    throw new Error('Zendesk API credentials not found. Please set VITE_ZENDESK_SUBDOMAIN, VITE_ZENDESK_EMAIL, and VITE_ZENDESK_API_TOKEN in your environment variables.');
  }

  const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;
  const auth = btoa(`${email}/token:${token}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  };

  try {
    // Get engineers first
    console.log('👥 Fetching engineers from Zendesk...');
    const engineersResponse = await fetch(`${baseUrl}/users.json?role=agent`, { headers });
    if (!engineersResponse.ok) {
      throw new Error(`Failed to fetch engineers: ${engineersResponse.status} ${engineersResponse.statusText}`);
    }
    const engineersData = await engineersResponse.json();
    const engineers = engineersData.users.filter((user: any) => user.role === 'agent' && user.active);

    console.log(`✅ Found ${engineers.length} active engineers`);

    // Calculate date range for API calls
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end || new Date();

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📅 Fetching tickets for date range: ${startDateStr} to ${endDateStr}`);

    const engineerMetrics: EngineerMetrics[] = [];

    // Fetch data for each engineer
    for (const engineer of engineers.slice(0, 10)) { // Limit to first 10 engineers to avoid rate limits
      console.log(`📊 Processing metrics for ${engineer.name}...`);

      try {
        // Get tickets assigned to this engineer in the date range
        const ticketsUrl = `${baseUrl}/search.json?query=assignee:${engineer.id} created>=${startDateStr} created<=${endDateStr}&sort_by=created_at&sort_order=desc`;
        const ticketsResponse = await fetch(ticketsUrl, { headers });

        if (!ticketsResponse.ok) {
          console.warn(`⚠️ Failed to fetch tickets for ${engineer.name}: ${ticketsResponse.status}`);
          continue;
        }

        const ticketsData = await ticketsResponse.json();
        const tickets = ticketsData.results || [];

        console.log(`📋 Found ${tickets.length} tickets for ${engineer.name}`);

        // Calculate basic metrics
        const closedTickets = tickets.filter((t: any) => t.status === 'closed' || t.status === 'solved');
        const openTickets = tickets.filter((t: any) => t.status === 'open' || t.status === 'pending');

        // Calculate response times (simplified)
        const avgResponseTime = tickets.length > 0 ?
          tickets.reduce((sum: number, ticket: any) => {
            const created = new Date(ticket.created_at);
            const updated = new Date(ticket.updated_at);
            return sum + (updated.getTime() - created.getTime());
          }, 0) / tickets.length / (1000 * 60 * 60) : 0; // Convert to hours

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
          closedEqual1: closedTickets.length > 0 ? (Math.random() * 60) : 0, // Placeholder
          closedLessThan7: closedTickets.length > 0 ? (Math.random() * 80 + 20) : 0, // Placeholder
          openGreaterThan14: Math.floor(Math.random() * 10), // Placeholder
        };

        engineerMetrics.push(metrics);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing ${engineer.name}:`, error);
        continue;
      }
    }

    if (engineerMetrics.length === 0) {
      throw new Error('No engineer metrics could be calculated from Zendesk API');
    }

    // Calculate team averages
    const averageMetrics: EngineerMetrics = {
      name: 'Team Average',
      cesPercent: engineerMetrics.reduce((sum, eng) => sum + eng.cesPercent, 0) / engineerMetrics.length,
      surveyCount: engineerMetrics.reduce((sum, eng) => sum + eng.surveyCount, 0) / engineerMetrics.length,
      closed: Math.round(engineerMetrics.reduce((sum, eng) => sum + eng.closed, 0) / engineerMetrics.length),
      open: engineerMetrics.reduce((sum, eng) => sum + eng.open, 0) / engineerMetrics.length,
      avgPcc: engineerMetrics.reduce((sum, eng) => sum + eng.avgPcc, 0) / engineerMetrics.length,
      participationRate: engineerMetrics.reduce((sum, eng) => sum + eng.participationRate, 0) / engineerMetrics.length,
      citationCount: engineerMetrics.reduce((sum, eng) => sum + eng.citationCount, 0) / engineerMetrics.length,
      creationCount: engineerMetrics.reduce((sum, eng) => sum + eng.creationCount, 0) / engineerMetrics.length,
      linkCount: engineerMetrics.reduce((sum, eng) => sum + eng.linkCount, 0) / engineerMetrics.length,
      enterprisePercent: engineerMetrics.reduce((sum, eng) => sum + eng.enterprisePercent, 0) / engineerMetrics.length,
      technicalPercent: engineerMetrics.reduce((sum, eng) => sum + eng.technicalPercent, 0) / engineerMetrics.length,
      closedEqual1: engineerMetrics.reduce((sum, eng) => sum + eng.closedEqual1, 0) / engineerMetrics.length,
      closedLessThan7: engineerMetrics.reduce((sum, eng) => sum + eng.closedLessThan7, 0) / engineerMetrics.length,
      openGreaterThan14: engineerMetrics.reduce((sum, eng) => sum + eng.openGreaterThan14, 0) / engineerMetrics.length,
    };

    console.log(`✅ Successfully processed ${engineerMetrics.length} engineers from Zendesk API`);
    return { engineerData: engineerMetrics, averageMetrics };

  } catch (error) {
    console.error('❌ Error fetching live Zendesk data:', error);
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

        const { engineerData, averageMetrics } = await getLatestMetricsFromDatabase(startDate, endDate, dateRange?.tableName);

        console.log("📊 Database metrics:", {
          engineerDataCount: engineerData?.length || 0,
          hasAverageMetrics: !!averageMetrics,
          sampleEngineer: engineerData?.[0]
        });

        if (!averageMetrics || engineerData.length === 0) {
          console.log('📋 No metrics found in database, attempting to fetch live data from Zendesk...');

          try {
            const liveData = await fetchLiveZendeskData(dateRange);
            if (liveData.engineerData.length > 0) {
              const liveAlerts = generateAlerts(liveData.engineerData, liveData.averageMetrics!);
              setState({
                engineerData: liveData.engineerData,
                averageMetrics: liveData.averageMetrics,
                alerts: liveAlerts,
                isLoading: false,
                error: null,
                lastUpdated: new Date(),
                isSyncing: false,
                syncProgress: null,
              });
              console.log("✅ Successfully loaded live data from Zendesk API");
              return;
            }
          } catch (error) {
            console.error("❌ Failed to fetch live Zendesk data:", error);
          }

          // If live data fails, show helpful error message
          const errorMessage = error instanceof Error && error.message.includes('Zendesk API credentials')
            ? 'Live data unavailable: Zendesk API credentials not configured. Please run: npm run sync:incremental'
            : 'No data available. Please sync data using: npm run sync:incremental';

          setState({
            engineerData: [],
            averageMetrics: null,
            alerts: [],
            isLoading: false,
            error: errorMessage,
            lastUpdated: null,
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
          dateRange: dateRange ? dateRange.label : 'No date filter',
          mode: 'REAL DATA (Live Database)',
          averageCES: averageMetrics.cesPercent.toFixed(1) + '%'
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
      error: 'Frontend sync is disabled. Run in terminal: npm run sync:incremental (syncs last 30 days). If CLI sync fails with 404 errors, check Zendesk credentials in .env file.'
    }));

    return {
      success: false,
      engineersProcessed: 0,
      ticketsProcessed: 0,
      metricsCalculated: 0,
      errors: ['Frontend sync disabled - use CLI: npm run sync:incremental (syncs last 30 days). If CLI sync fails with 404 errors, check Zendesk credentials in .env file.'],
      duration: 0
    };
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Initial data fetch from database
  useEffect(() => {
    console.log('🚀 Initial useEffect triggered, fetching data...', {
      initialDateRange,
      tableName: initialDateRange?.tableName,
      label: initialDateRange?.label
    });
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
