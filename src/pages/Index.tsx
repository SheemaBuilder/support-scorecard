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
  BarChart3,
  Shield,
  FileText,
  Star,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { PerformanceTable } from "../components/PerformanceTable";
import { RadarChart } from "../components/RadarChart";
import { MetricCard } from "../components/MetricCard";
import { useZendeskData, useZendeskConfig } from "../hooks/use-zendesk-data";
import { DateRange } from "../lib/types";
import { cn } from "../lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";

// Helper function to check if a date is a weekend (Saturday or Sunday)
const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

// Helper function to calculate working days backwards from today
const getWorkingDaysBack = (workingDaysCount: number): Date => {
  const today = new Date();
  let daysFound = 0;
  let currentDate = new Date(today);

  // Start from yesterday and go backwards
  currentDate.setDate(currentDate.getDate() - 1);

  while (daysFound < workingDaysCount) {
    if (!isWeekend(currentDate)) {
      daysFound++;
    }
    if (daysFound < workingDaysCount) {
      currentDate.setDate(currentDate.getDate() - 1);
    }
  }

  currentDate.setHours(0, 0, 0, 0);
  return currentDate;
};

// Helper function to get first working day of a month
const getFirstWorkingDayOfMonth = (year: number, month: number): Date => {
  const firstDay = new Date(year, month, 1);
  while (isWeekend(firstDay)) {
    firstDay.setDate(firstDay.getDate() + 1);
  }
  firstDay.setHours(0, 0, 0, 0);
  return firstDay;
};

// Helper function to get last working day of a month
const getLastWorkingDayOfMonth = (year: number, month: number): Date => {
  const lastDay = new Date(year, month + 1, 0); // Last day of the month
  while (isWeekend(lastDay)) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  lastDay.setHours(23, 59, 59, 999);
  return lastDay;
};

// Default date ranges - calculated using working days (excluding weekends)
const getDateRanges = (): DateRange[] => {
  const today = new Date();
  const endOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999,
  );

  // Calculate start date for last 30 working days
  const thirtyWorkingDaysAgo = getWorkingDaysBack(30);

  // Calculate start date for last 7 working days
  const sevenWorkingDaysAgo = getWorkingDaysBack(7);

  // This month: first working day of current month to today
  const thisMonthStart = getFirstWorkingDayOfMonth(today.getFullYear(), today.getMonth());

  // Last month: first to last working day of previous month
  const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const lastMonthMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
  const lastMonthStart = getFirstWorkingDayOfMonth(lastMonthYear, lastMonthMonth);
  const lastMonthEnd = getLastWorkingDayOfMonth(lastMonthYear, lastMonthMonth);

  return [
    {
      label: "Last 30 Working Days",
      value: "last-30-days",
      start: thirtyWorkingDaysAgo,
      end: endOfToday,
    },
    {
      label: "Last 7 Working Days",
      value: "last-7-days",
      start: sevenWorkingDaysAgo,
      end: endOfToday,
    },
    {
      label: "This Month (Working Days)",
      value: "this-month",
      start: thisMonthStart,
      end: endOfToday,
    },
    {
      label: "Last Month (Working Days)",
      value: "last-month",
      start: lastMonthStart,
      end: lastMonthEnd,
    },
  ];
};

const dateRanges = getDateRanges();

export default function Index() {
  const [selectedPeriod, setSelectedPeriod] = useState(dateRanges[0]);
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Check if Zendesk is configured
  const { isConfigured, config } = useZendeskConfig();

  // Fetch data from Zendesk
  const {
    engineerData,
    averageMetrics,
    alerts,
    isLoading,
    error,
    lastUpdated,
    refetch,
    clearError,
  } = useZendeskData(selectedPeriod);

  // Set default selected engineer when data loads
  React.useEffect(() => {
    if (engineerData.length > 0 && !selectedEngineer) {
      setSelectedEngineer(engineerData[0].name);
    }
  }, [engineerData, selectedEngineer]);

  const currentEngineer =
    engineerData.find((e) => e.name === selectedEngineer) || engineerData[0];

  // Handle period change
  const handlePeriodChange = async (newPeriod: DateRange) => {
    setSelectedPeriod(newPeriod);
    await refetch(newPeriod);
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
            Zendesk API credentials are not configured. Please check your .env
            file.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <div>✓ VITE_ZENDESK_SUBDOMAIN: {config.subdomain || "Missing"}</div>
            <div>✓ VITE_ZENDESK_EMAIL: {config.email || "Missing"}</div>
            <div>
              ✓ VITE_ZENDESK_API_TOKEN: {config.hasApiToken ? "Set" : "Missing"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if we're in cloud environment
  const isCloudEnv =
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

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
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 flex items-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-700">Loading Zendesk data...</span>
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
                onClick={() => refetch(selectedPeriod)}
                disabled={isLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
                title="Pull latest data from Zendesk"
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 text-white",
                    isLoading && "animate-spin",
                  )}
                />
                <span className="text-sm font-medium">Pull Data</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Debug Section */}
      <div className="bg-orange-50 border-b border-orange-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center space-x-2 text-orange-800 hover:text-orange-900"
          >
            <span className="text-red-600">◀</span>
            <span className="text-sm font-medium">
              Debug Info (Click to expand)
            </span>
          </button>

          {showDebug && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="text-orange-800">
                <span className="font-medium">Engineers loaded:</span>{" "}
                {engineerData.length}
              </div>
              <div className="text-orange-800">
                <span className="font-medium">Average metrics:</span>{" "}
                {averageMetrics ? "✅ Loaded" : "❌ Not loaded"}
              </div>
              <div className="text-orange-800">
                <span className="font-medium">Loading:</span>{" "}
                {isLoading ? "🔄 In progress" : "✅ Complete"}
              </div>
              <div className="text-orange-800">
                <span className="font-medium">Error:</span> {error || "None"}
              </div>
              <div className="text-orange-800">
                <span className="font-medium">Last updated:</span>{" "}
                {lastUpdated ? lastUpdated.toLocaleString() : "Never"}
              </div>
              {engineerData.length > 0 && (
                <div className="text-orange-800">
                  <span className="font-medium">Sample engineer:</span>{" "}
                  {engineerData[0].name} - Closed: {engineerData[0].closed},
                  CES: {engineerData[0].cesPercent.toFixed(1)}%
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/test-zendesk");
                      const data = await response.json();
                      alert(
                        data.success
                          ? `✅ Connected! User: ${data.user.name}`
                          : `❌ Failed: ${data.error}`,
                      );
                    } catch (error) {
                      alert(`❌ Connection failed: ${error}`);
                    }
                  }}
                  className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  <span>🔧</span>
                  <span>Test Zendesk API</span>
                </button>

                <button
                  onClick={() => refetch(selectedPeriod)}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                >
                  <span>🔄</span>
                  <span>Reload Data</span>
                </button>

                {currentEngineer && (
                  <button
                    onClick={() =>
                      alert(
                        `Engineer: ${currentEngineer.name}\nCES: ${currentEngineer.cesPercent.toFixed(1)}%\nClosed Tickets: ${currentEngineer.closed}\nSurvey Count: ${currentEngineer.surveyCount}`,
                      )
                    }
                    className="flex items-center space-x-2 px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                  >
                    <span>🔍</span>
                    <span>Find {currentEngineer.name}'s CES Tickets</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
        <Tabs defaultValue="scorecard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="scorecard" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Score Card</span>
            </TabsTrigger>
            <TabsTrigger value="ces" className="flex items-center space-x-2">
              <Star className="w-4 h-4" />
              <span>CES Deep Dive</span>
            </TabsTrigger>
            <TabsTrigger value="qa" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Quality Assurance</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Monthly Summary</span>
            </TabsTrigger>
          </TabsList>

          {/* Score Card Tab */}
          <TabsContent value="scorecard">
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
              title="Avg Response Time"
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
            <div className="text-sm text-gray-500">
              {lastUpdated && (
                <span>
                  Last Updated: {lastUpdated.toLocaleDateString()} at{" "}
                  {lastUpdated.toLocaleTimeString()}
                </span>
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
                  Loading engineers...
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

                  </TabsContent>

          {/* CES Deep Dive Tab */}
          <TabsContent value="ces">
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span>CES Score Distribution</span>
                    </CardTitle>
                    <CardDescription>Customer Effort Score breakdown by engineer</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {engineerData.length > 0 ? (
                      <div className="space-y-4">
                        {engineerData.map((engineer) => (
                          <div key={engineer.name} className="flex items-center justify-between">
                            <span className="font-medium">{engineer.name}</span>
                            <div className="flex items-center space-x-3">
                              <Progress value={engineer.cesPercent} className="w-24" />
                              <Badge variant={engineer.cesPercent >= 85 ? "default" : engineer.cesPercent >= 75 ? "secondary" : "destructive"}>
                                {engineer.cesPercent.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">No CES data available</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>CES Trends & Insights</CardTitle>
                    <CardDescription>Analysis of customer effort patterns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Top Performers</h4>
                        <div className="space-y-1">
                          {engineerData
                            .filter(e => e.cesPercent >= 85)
                            .slice(0, 3)
                            .map(engineer => (
                              <div key={engineer.name} className="text-sm text-green-700">
                                {engineer.name}: {engineer.cesPercent.toFixed(1)}%
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">Improvement Opportunities</h4>
                        <div className="space-y-1">
                          {engineerData
                            .filter(e => e.cesPercent < 85)
                            .slice(0, 3)
                            .map(engineer => (
                              <div key={engineer.name} className="text-sm text-yellow-700">
                                {engineer.name}: {engineer.cesPercent.toFixed(1)}%
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>CES Score Analysis</CardTitle>
                  <CardDescription>Detailed breakdown of customer effort metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {averageMetrics ? averageMetrics.cesPercent.toFixed(1) : "--"}%
                      </div>
                      <div className="text-sm text-gray-600">Team Average</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {engineerData.filter(e => e.cesPercent >= 85).length}
                      </div>
                      <div className="text-sm text-gray-600">Excellent (≥85%)</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {engineerData.filter(e => e.cesPercent < 75).length}
                      </div>
                      <div className="text-sm text-gray-600">Needs Attention (<75%)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Quality Assurance Tab */}
          <TabsContent value="qa">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span>Quality Metrics Overview</span>
                  </CardTitle>
                  <CardDescription>Comprehensive quality assessment across all engineers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {averageMetrics ? averageMetrics.participationRate.toFixed(1) : "--"}
                      </div>
                      <div className="text-sm text-gray-600">Avg Quality Score</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {averageMetrics ? averageMetrics.citationCount.toFixed(1) : "--"}
                      </div>
                      <div className="text-sm text-gray-600">Response Quality</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {averageMetrics ? averageMetrics.creationCount.toFixed(1) : "--"}
                      </div>
                      <div className="text-sm text-gray-600">Technical Accuracy</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {averageMetrics ? averageMetrics.linkCount.toFixed(1) : "--"}
                      </div>
                      <div className="text-sm text-gray-600">Communication</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quality Performance by Engineer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {engineerData.slice(0, 8).map((engineer) => (
                        <div key={engineer.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{engineer.name}</span>
                            <Badge variant={engineer.participationRate >= 4 ? "default" : "secondary"}>
                              {engineer.participationRate.toFixed(1)}/5.0
                            </Badge>
                          </div>
                          <Progress value={(engineer.participationRate / 5) * 100} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>QA Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Areas of Excellence
                        </h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>• Strong technical accuracy across the team</li>
                          <li>• Consistent response quality standards</li>
                          <li>• Good customer communication patterns</li>
                        </ul>
                      </div>

                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Focus Areas
                        </h4>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          <li>• Improve response time consistency</li>
                          <li>• Enhance first-contact resolution</li>
                          <li>• Standardize quality documentation</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Monthly Summary Tab */}
          <TabsContent value="summary">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <span>Monthly Performance Summary</span>
                  </CardTitle>
                  <CardDescription>
                    {selectedPeriod.label} • Generated on {new Date().toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-6 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600 mb-2">
                        {engineerData.reduce((sum, eng) => sum + eng.closed, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Tickets Resolved</div>
                    </div>
                    <div className="text-center p-6 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {averageMetrics ? averageMetrics.cesPercent.toFixed(1) : "--"}%
                      </div>
                      <div className="text-sm text-gray-600">Average CES Score</div>
                    </div>
                    <div className="text-center p-6 bg-purple-50 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600 mb-2">
                        {averageMetrics ? averageMetrics.avgPcc.toFixed(1) : "--"}h
                      </div>
                      <div className="text-sm text-gray-600">Avg Response Time</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Key Achievements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium">Excellent Team Performance</h4>
                          <p className="text-sm text-gray-600">
                            {engineerData.filter(e => e.cesPercent >= 85).length} engineers achieved CES scores above 85%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium">High Resolution Rate</h4>
                          <p className="text-sm text-gray-600">
                            Successfully resolved {engineerData.reduce((sum, eng) => sum + eng.closed, 0)} tickets this period
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium">Quality Consistency</h4>
                          <p className="text-sm text-gray-600">
                            Maintained high quality standards across all support channels
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations for Next Month</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 border-l-4 border-blue-500 bg-blue-50">
                        <h4 className="font-medium text-blue-800">Training Focus</h4>
                        <p className="text-sm text-blue-700">
                          Implement advanced customer communication workshops for engineers with CES scores below 85%
                        </p>
                      </div>
                      <div className="p-4 border-l-4 border-green-500 bg-green-50">
                        <h4 className="font-medium text-green-800">Process Improvement</h4>
                        <p className="text-sm text-green-700">
                          Deploy new knowledge base tools to reduce average response time by 15%
                        </p>
                      </div>
                      <div className="p-4 border-l-4 border-purple-500 bg-purple-50">
                        <h4 className="font-medium text-purple-800">Team Development</h4>
                        <p className="text-sm text-purple-700">
                          Establish peer mentoring program to share best practices across the team
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">Total Surveys</div>
                      <div className="text-gray-600">
                        {engineerData.reduce((sum, eng) => sum + eng.surveyCount, 0)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Avg Technical %</div>
                      <div className="text-gray-600">
                        {averageMetrics ? averageMetrics.technicalPercent.toFixed(1) : "--"}%
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Enterprise %</div>
                      <div className="text-gray-600">
                        {averageMetrics ? averageMetrics.enterprisePercent.toFixed(1) : "--"}%
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Open Tickets</div>
                      <div className="text-gray-600">
                        {engineerData.reduce((sum, eng) => sum + eng.open, 0)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

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