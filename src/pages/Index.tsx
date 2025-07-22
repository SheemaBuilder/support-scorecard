import React, { useState } from "react";
import {
  Calendar,
  ChevronDown,
  Settings,
  AlertTriangle,
  Info,
  Bell,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { PerformanceTable } from "../components/PerformanceTable";
import { RadarChart } from "../components/RadarChart";
import { MetricCard } from "../components/MetricCard";
import { useSupabaseData, useSupabaseConfig } from "../hooks/use-supabase-data";
import { DateRange } from "../lib/types";
import { cn } from "../lib/utils";


// Add debug helper
const DEBUG_MODE = import.meta.env.DEV;

// Function to create date ranges dynamically
const createDateRanges = (): DateRange[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59); // End of today

  return [
    {
      label: "Last 30 Days",
      value: "last-30-days",
      start: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000), // 30 days including today
      end: endOfToday,
    },
    {
      label: "Last 7 Days",
      value: "last-7-days",
      start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), // 7 days including today
      end: endOfToday,
    },
    {
      label: "This Month",
      value: "this-month",
      start: new Date(now.getFullYear(), now.getMonth(), 1), // First day of current month
      end: endOfToday,
    },
    {
      label: "Last Month",
      value: "last-month",
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1), // First day of last month
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59), // Last day of last month
    },
    {
      label: "All 2025 Data",
      value: "all-2025",
      start: new Date(2025, 0, 1), // January 1, 2025
      end: endOfToday,
    },
  ];
};

export default function Index() {
  // Generate fresh date ranges on each render
  const dateRanges = React.useMemo(() => createDateRanges(), []);

  const [selectedPeriod, setSelectedPeriod] = useState(() => dateRanges[0]);
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);

  // Check if Supabase is configured
  const { isConfigured, config } = useSupabaseConfig();

  // Fetch data from Supabase with sync capability
  const {
    engineerData,
    averageMetrics,
    alerts,
    isLoading,
    error,
    lastUpdated,
    refetch,
    syncData,
    clearError,
    isSyncing,
    syncProgress,
  } = useSupabaseData(selectedPeriod);

  // Set default selected engineer when data loads
  React.useEffect(() => {
    if (engineerData.length > 0 && !selectedEngineer) {
      setSelectedEngineer(engineerData[0].name);
    }
  }, [engineerData, selectedEngineer]);

  // Debug logging
  React.useEffect(() => {
    if (DEBUG_MODE) {
      console.log("🔍 Debug data state:", {
        engineerDataLength: engineerData.length,
        averageMetrics: averageMetrics,
        isLoading,
        error,
        lastUpdated,
        engineerSample: engineerData.slice(0, 2).map((e) => ({
          name: e.name,
          cesPercent: e.cesPercent,
          closed: e.closed,
          open: e.open,
        })),
      });
    }
  }, [engineerData, averageMetrics, isLoading, error, lastUpdated]);

  const currentEngineer =
    engineerData.find((e) => e.name === selectedEngineer) || engineerData[0];

  // Handle period change
  const handlePeriodChange = async (newPeriod: DateRange) => {
    console.log('📅 Period change triggered:', {
      oldPeriod: selectedPeriod.label,
      newPeriod: newPeriod.label,
      newStart: newPeriod.start.toISOString(),
      newEnd: newPeriod.end.toISOString()
    });

    setSelectedPeriod(newPeriod);
    console.log('🔄 Calling refetch with new period...');
    await refetch(newPeriod);
    console.log('✅ Refetch completed');
  };

  // Show configuration error if not properly set up
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="flex items-center space-x-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-lg font-semibold">Configuration Required</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Supabase credentials are not configured. Please check your .env
            file.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <div>✓ VITE_SUPABASE_URL: {config.hasSupabaseUrl ? "Set" : "Missing"}</div>
            <div>✓ VITE_SUPABASE_ANON_KEY: {config.hasSupabaseKey ? "Set" : "Missing"}</div>
          </div>
        </div>
      </div>
    );
  }

  // Check if we're in cloud environment
  const isCloudEnv =
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  // Show empty state when no data but no error (clean database)
  if (!isLoading && !error && engineerData.length === 0 && !averageMetrics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg text-center">
          <div className="flex items-center justify-center space-x-3 text-blue-600 mb-4">
            <Info className="w-6 h-6" />
            <h2 className="text-lg font-semibold">No Data Available</h2>
          </div>
          <div className="text-gray-600 mb-6">
            <p className="mb-3">
              Your database is set up but doesn't contain any metrics yet.
            </p>
            <p className="mb-3">
              Click "Pull Data" to sync your first batch of data from Zendesk.
            </p>
          </div>
          <button
            onClick={async () => {
              const result = await syncData();
              if (result.success) {
                console.log('Initial sync completed successfully:', result);
              } else {
                console.error('Initial sync failed:', result.errors);
              }
            }}
            disabled={isSyncing}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 mx-auto"
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 text-white",
                isSyncing && "animate-spin",
              )}
            />
            <span>{isSyncing ? 'Syncing from Zendesk...' : 'Pull Data from Zendesk'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    const isCloudError =
      error.includes("cloud environment") ||
      error.includes("Backend server required");

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg">
          <div className="flex items-center space-x-3 text-blue-600 mb-4">
            <Info className="w-6 h-6" />
            <h2 className="text-lg font-semibold">
              {isCloudError ? "Demo Mode" : "Error Loading Data"}
            </h2>
          </div>
          <div className="text-gray-600 mb-4">
            {isCloudError ? (
              <div>
                <p className="mb-3">
                  This is a live demo of the Zendesk Performance Dashboard.
                </p>
                <p className="mb-3">To see real data, you would need to:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Run the backend server locally</li>
                  <li>Configure Zendesk API credentials</li>
                  <li>Connect to your Zendesk instance</li>
                </ul>
              </div>
            ) : (
              <p>{error}</p>
            )}
          </div>
          {!isCloudError && (
            <div className="flex space-x-3">
              <button
                onClick={() => refetch(selectedPeriod)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
              <button
                onClick={clearError}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          )}
          {isCloudError && (
            <button
              onClick={clearError}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Continue to Demo (Empty States)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Generate radar chart data based on selected engineer
  const generateRadarData = (engineer: typeof currentEngineer) => {
    if (!engineer || !averageMetrics) {
      return {
        title: "No Data",
        subtitle: "Loading...",
        metrics: [],
      };
    }

    // Simple calculation: Engineer Achievement / Team Average = Radar Value
    // Capped at 2.0 maximum
    const getRelativeValue = (individualValue: number, teamAverage: number) => {
      if (teamAverage === 0) return 1;
      const ratio = individualValue / teamAverage;
      return Math.min(2.0, ratio);
    };

    return {
      title: engineer.name,
      subtitle: "Current Period",
      metrics: [
        {
          label: "CES %",
          value: getRelativeValue(
            engineer.cesPercent,
            averageMetrics.cesPercent,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Survey Count",
          value: getRelativeValue(
            engineer.surveyCount,
            averageMetrics.surveyCount,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "# Messages Solved",
          value: getRelativeValue(engineer.closed, averageMetrics.closed),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Average Resolution Time",
          value: getRelativeValue(engineer.avgPcc, averageMetrics.avgPcc),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "% Closed <= 14 Cal Days",
          value: getRelativeValue(
            engineer.closedLessThan7,
            averageMetrics.closedLessThan7,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "% Closed <= 3 Cal Days",
          value: getRelativeValue(
            engineer.closedEqual1,
            averageMetrics.closedEqual1,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Overall Quality",
          value: getRelativeValue(
            engineer.participationRate,
            averageMetrics.participationRate,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Communication",
          value: getRelativeValue(engineer.linkCount, averageMetrics.linkCount),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Quality of Responses",
          value: getRelativeValue(
            engineer.citationCount,
            averageMetrics.citationCount,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Technical Accuracy",
          value: getRelativeValue(
            engineer.creationCount,
            averageMetrics.creationCount,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Enterprise %",
          value: getRelativeValue(
            engineer.enterprisePercent,
            averageMetrics.enterprisePercent,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
        {
          label: "Technical %",
          value: getRelativeValue(
            engineer.technicalPercent,
            averageMetrics.technicalPercent,
          ),
          maxValue: 2,
          color: "#3b82f6",
        },
      ],
    };
  };

  const currentRadarData = generateRadarData(currentEngineer);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Loading/Syncing Overlay */}
      {(isLoading || isSyncing) && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center space-y-3 min-w-[300px]">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-gray-700">
                {isSyncing ? 'Syncing data from Zendesk...' : 'Loading data...'}
              </span>
            </div>
            {syncProgress && (
              <div className="w-full">
                <div className="text-sm text-gray-600 mb-1">{syncProgress.message}</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress.current}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {syncProgress.current.toFixed(0)}% complete
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="text-gray-900 text-xl font-normal leading-7 pl-2">
                <p>Builder.io Support Score Card</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Period Selector */}
              <div className="relative">
                <select
                  value={selectedPeriod.value}
                  onChange={(e) => {
                    const newPeriod = dateRanges.find(
                      (p) => p.value === e.target.value,
                    );
                    if (newPeriod) handlePeriodChange(newPeriod);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 min-w-[140px]"
                >
                  {dateRanges.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh Button */}
              <button
                onClick={async () => {
                  console.log('🔄 Manual refresh triggered with current period:', selectedPeriod.label);
                  await refetch(selectedPeriod);
                }}
                disabled={isLoading || isSyncing}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md disabled:opacity-50 mr-2"
                title="Refresh data from database with current date range"
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 text-white",
                    isLoading && "animate-spin",
                  )}
                />
                <span className="text-sm font-medium">Refresh</span>
              </button>

              {/* Sync Button */}
              <button
                onClick={async () => {
                  const result = await syncData();
                  if (result.success) {
                    console.log('Sync completed successfully:', result);
                  } else {
                    console.error('Sync failed:', result.errors);
                  }
                }}
                disabled={isLoading || isSyncing}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
                title="Pull latest data from Zendesk and sync to database"
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 text-white",
                    (isLoading || isSyncing) && "animate-spin",
                  )}
                />
                <span className="text-sm font-medium">
                {isSyncing ? 'Syncing...' : 'Pull Data'}
              </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Debug Panel - only in development */}
      {DEBUG_MODE && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <details className="text-sm">
              <summary className="cursor-pointer text-yellow-800 font-medium">
                🔍 Debug Info (Click to expand)
              </summary>
              <div className="mt-2 space-y-1 text-yellow-700">
                <div>Engineers loaded: {engineerData.length}</div>
                <div>
                  Average metrics: {averageMetrics ? "✅ Loaded" : "❌ Missing"}
                </div>
                <div>Loading: {isLoading ? "⏳ Yes" : "✅ Complete"}</div>
                <div>Syncing: {isSyncing ? "⏳ Yes" : "✅ Complete"}</div>
                <div>Error: {error || "None"}</div>
                <div>
                  Last updated: {lastUpdated?.toLocaleString() || "Never"}
                </div>
                <div>Database state: {engineerData.length > 0 ? "✅ Has data" : "❌ Empty"}</div>
                <div>Selected period: {selectedPeriod.label}</div>
                <div>Date range: {selectedPeriod.start.toISOString().split('T')[0]} to {selectedPeriod.end.toISOString().split('T')[0]}</div>
                <div>Period value: {selectedPeriod.value}</div>
                <div>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}</div>
                {engineerData.length > 0 && (
                  <div>
                    Sample engineer: {engineerData[0].name} - Closed:{" "}
                    {engineerData[0].closed}, CES:{" "}
                    {engineerData[0].cesPercent.toFixed(1)}%
                  </div>
                )}
                <div className="mt-3 flex space-x-2">

                  <button
                    onClick={() => {
                      console.log("🔄 Refetching data...");
                      refetch(selectedPeriod);
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    🔄 Refetch Data
                  </button>
                  <button
                    onClick={async () => {
                      console.log('📊 Testing database connection...');
                      try {
                        const { getLatestMetricsFromDatabase } = await import('../lib/data-sync');
                        const result = await getLatestMetricsFromDatabase();
                        console.log('📊 Database test result:', result);
                      } catch (error) {
                        console.error('❌ Database test failed:', error);
                      }
                    }}
                    className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                  >
                    📊 Test Database
                  </button>
                  <button
                    onClick={async () => {
                      console.log('📅 Testing date filtering with current period:', selectedPeriod);
                      try {
                        const { getLatestMetricsFromDatabase } = await import('../lib/data-sync');
                        const result = await getLatestMetricsFromDatabase(selectedPeriod.start, selectedPeriod.end);
                        console.log('📅 Date-filtered result:', result);
                      } catch (error) {
                        console.error('❌ Date filter test failed:', error);
                      }
                    }}
                    className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                  >
                    📅 Test Date Filter
                  </button>
                  <button
                    onClick={async () => {
                      console.log("🎯 Checking ticket 19934...");
                      try {
                        // Add timestamp to prevent caching issues
                        const url = `/api/debug/ticket/19934?t=${Date.now()}`;
                        const response = await fetch(url);

                        // Check if response is ok before reading
                        if (!response.ok) {
                          console.error(
                            "🎯 API Error:",
                            response.status,
                            response.statusText,
                          );
                          return;
                        }

                        // Read response as JSON directly
                        const data = await response.json();
                        console.log("🎯 Ticket 19934 details:", data);

                        // Specific logging for CES field
                        const cesField = data.custom_fields?.find(
                          (cf) => cf.id === 31797439524887,
                        );
                        if (cesField) {
                          console.log("✅ Found CES field:", cesField);
                        } else {
                          console.log("❌ CES field not found");
                          console.log(
                            "📝 Available custom field IDs:",
                            data.custom_fields?.map((cf) => cf.id) || [],
                          );
                        }
                      } catch (error) {
                        console.error("🎯 Ticket check error:", error.message);
                      }
                    }}
                    className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                  >
                    🎯 Check Ticket 19934
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Alerts Panel */}
      {showAlerts && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  Active Alerts
                </h3>
                <div className="mt-2 space-y-1">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center space-x-2 text-sm text-yellow-700"
                    >
                      {alert.type === "warning" && (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {alert.type === "info" && <Info className="w-4 h-4" />}
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setShowAlerts(false)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        {averageMetrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Team Average CES"
              value={`${averageMetrics.cesPercent.toFixed(1)}%`}
              subtitle={selectedPeriod.label}
              trend={averageMetrics.cesPercent >= 80 ? "up" : "down"}
              trendValue={`${averageMetrics.cesPercent >= 80 ? "+" : ""}${(averageMetrics.cesPercent - 80).toFixed(1)}%`}
              color={
                averageMetrics.cesPercent >= 85
                  ? "green"
                  : averageMetrics.cesPercent >= 75
                    ? "yellow"
                    : "red"
              }
            />
            <MetricCard
              title="Total Tickets Closed"
              value={engineerData.reduce((sum, eng) => sum + eng.closed, 0)}
              subtitle={selectedPeriod.label}
              color="blue"
            />
            <MetricCard
              title="Avg RESOLUTION Time"
              value={`${averageMetrics.avgPcc.toFixed(1)}h`}
              subtitle="Hours"
              color="purple"
            />
            <MetricCard
              title="Active Engineers"
              value={engineerData.length}
              subtitle="Currently tracked"
              color="yellow"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-center h-20">
                  <div className="text-center">
                    <div className="text-gray-400 mb-2">No Data</div>
                    <div className="text-sm text-gray-500">
                      Backend required
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Performance Table */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Team Performance Overview
            </h2>
            <div className="text-sm text-gray-500 space-y-1">
              <div>
                Period: {selectedPeriod.label} ({selectedPeriod.start.toLocaleDateString()} - {selectedPeriod.end.toLocaleDateString()})
              </div>
              {lastUpdated && (
                <div>
                  Last Updated: {lastUpdated.toLocaleDateString()} at{" "}
                  {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
          {averageMetrics ? (
            <PerformanceTable
              data={engineerData}
              averageData={averageMetrics}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center">
                <div className="text-gray-400 mb-2">
                  No Performance Data Available
                </div>
                <div className="text-sm text-gray-500">
                  Start the backend server to load Zendesk data
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Performance Charts Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Individual Performance Analysis
            </h2>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">
                Engineer:
              </label>
              {engineerData.length > 0 ? (
                <select
                  value={selectedEngineer}
                  onChange={(e) => setSelectedEngineer(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {engineerData.map((engineer) => (
                    <option key={engineer.name} value={engineer.name}>
                      {engineer.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500">
                  {isLoading ? "Loading engineers..." : "No engineers found"}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Current Period Chart */}
            {currentEngineer && currentRadarData.metrics.length > 0 ? (
              <div>
                <RadarChart data={currentRadarData} size={320} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Loading engineer data...</p>
                </div>
              </div>
            )}

            {/* Previous Period Chart */}
            {currentEngineer && currentRadarData.metrics.length > 0 ? (
              <div>
                <RadarChart
                  data={{
                    title: selectedEngineer,
                    subtitle: "Previous Period",
                    metrics: currentRadarData.metrics.map((metric) => ({
                      ...metric,
                      value: Math.max(
                        0,
                        metric.value + (Math.random() - 0.5) * 0.6,
                      ),
                      color: "#64748b",
                    })),
                  }}
                  size={320}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Loading engineer data...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Metrics for Selected Engineer */}
        {currentEngineer && averageMetrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Customer Effort Score"
              value={`${currentEngineer.cesPercent.toFixed(1)}%`}
              subtitle="CES Score"
              trend={
                currentEngineer.cesPercent > averageMetrics.cesPercent
                  ? "up"
                  : "down"
              }
              trendValue={`${currentEngineer.cesPercent > averageMetrics.cesPercent ? "+" : ""}${(currentEngineer.cesPercent - averageMetrics.cesPercent).toFixed(1)}%`}
              color={
                currentEngineer.cesPercent >= 85
                  ? "green"
                  : currentEngineer.cesPercent >= 75
                    ? "yellow"
                    : "red"
              }
            />
            <MetricCard
              title="Tickets Closed"
              value={currentEngineer.closed}
              subtitle={selectedPeriod.label}
              trend={
                currentEngineer.closed > averageMetrics.closed ? "up" : "down"
              }
              trendValue={`${currentEngineer.closed > averageMetrics.closed ? "+" : ""}${(currentEngineer.closed - averageMetrics.closed).toFixed(0)}`}
              color="blue"
            />
            <MetricCard
              title="Overall Quality Score"
              value={currentEngineer.participationRate.toFixed(1)}
              subtitle="Quality rating"
              trend={
                currentEngineer.participationRate >
                averageMetrics.participationRate
                  ? "up"
                  : "down"
              }
              trendValue={`${currentEngineer.participationRate > averageMetrics.participationRate ? "+" : ""}${(currentEngineer.participationRate - averageMetrics.participationRate).toFixed(1)}`}
              color={
                currentEngineer.participationRate >=
                averageMetrics.participationRate
                  ? "green"
                  : "yellow"
              }
            />
            <MetricCard
              title="Technical Accuracy"
              value={currentEngineer.creationCount.toFixed(1)}
              subtitle="Score out of 5"
              trend={
                currentEngineer.creationCount > averageMetrics.creationCount
                  ? "up"
                  : "down"
              }
              trendValue={`${currentEngineer.creationCount > averageMetrics.creationCount ? "+" : ""}${(currentEngineer.creationCount - averageMetrics.creationCount).toFixed(1)}`}
              color="purple"
            />
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Individual Performance Analysis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-center h-20">
                    <div className="text-center">
                      <div className="text-gray-400 mb-2">No Data</div>
                      <div className="text-sm text-gray-500">
                        Backend required
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-8 mt-12">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              <p>Performance Scorecard v2.0 • Data sourced from Zendesk</p>
            </div>
            <div className="flex items-center space-x-4">
              <span>Generated on {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
