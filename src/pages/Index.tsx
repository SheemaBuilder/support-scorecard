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
  Copy,
  Download,
  Clock,
} from "lucide-react";
import { PerformanceTable } from "../components/PerformanceTable";
import { RadarChart } from "../components/RadarChart";
import { MetricCard } from "../components/MetricCard";
import { useSupabaseData, useSupabaseConfig } from "../hooks/use-supabase-data";
import { DateRange } from "../lib/types";
import { cn } from "../lib/utils";
import { nameToIdMap } from "../lib/engineerMap.js";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";

// Add debug helper
const DEBUG_MODE = import.meta.env.DEV;

// Function to create monthly date ranges for 2025
const createDateRanges = (): DateRange[] => {
  const year = 2025;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return months.map((monthName, index) => {
    const monthStart = new Date(year, index, 1); // First day of month
    const monthEnd = new Date(year, index + 1, 0, 23, 59, 59); // Last day of month

    return {
      label: monthName,
      value: `${monthName.toLowerCase()}_${year}`,
      start: monthStart,
      end: monthEnd,
      tableName: `engineer_metrics_${monthName.toLowerCase()}_${year}` // Table name for this month
    };
  });
};

export default function Index() {
  // Generate fresh date ranges on each render
  const dateRanges = React.useMemo(() => {
    const ranges = createDateRanges();
    console.log('📅 Created date ranges:', ranges.map(r => ({ label: r.label, tableName: r.tableName })));
    return ranges;
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // Default to July 2025 (current month) - index 6
    const julyIndex = 6; // July is the 7th month (0-indexed = 6)
    const defaultPeriod = dateRanges[julyIndex] || dateRanges[0];
    console.log('🎯 Setting default period to:', {
      label: defaultPeriod?.label,
      tableName: defaultPeriod?.tableName,
      julyIndex,
      availableRanges: dateRanges.length
    });
    return defaultPeriod;
  });
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [selectedComparisonEngineer, setSelectedComparisonEngineer] =
    useState("");
  const [summaryTab, setSummaryTab] = useState("team"); // team or individual
  const [selectedIndividualEngineer, setSelectedIndividualEngineer] =
    useState("");
  const [selectedDebugDate, setSelectedDebugDate] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

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
    // Set default engineer only if none is selected
    if (engineerData.length > 0 && !selectedComparisonEngineer) {
      const jaredBeckler = engineerData.find(e => e.name === "Jared Beckler");
      const defaultEngineer = jaredBeckler ? "Jared Beckler" : engineerData[0].name;
      console.log(`🎯 Setting default CES engineer to: ${defaultEngineer}`);
      setSelectedComparisonEngineer(defaultEngineer);
    }
    if (engineerData.length > 0 && !selectedIndividualEngineer) {
      setSelectedIndividualEngineer(engineerData[0].name);
    }
  }, [
    engineerData,
    selectedEngineer,
    selectedComparisonEngineer,
    selectedIndividualEngineer,
  ]);

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

      // Debug Akash Singh's data specifically
      const akashData = engineerData.find(e => e.name === "Akash Singh");
      if (akashData) {
        console.log("🎯 AKASH SINGH RAW DATA:", {
          name: akashData.name,
          cesPercent: akashData.cesPercent,
          cesType: typeof akashData.cesPercent,
          cesValueIs0: akashData.cesPercent === 0,
          cesValueIsNull: akashData.cesPercent === null,
          cesValueIsUndefined: akashData.cesPercent === undefined,
          allMetrics: akashData
        });
      } else {
        console.log("❌ AKASH SINGH NOT FOUND IN ENGINEER DATA");
        console.log("📋 Available engineers:", engineerData.map(e => e.name));
      }
    }
  }, [engineerData, averageMetrics, isLoading, error, lastUpdated]);

  const currentEngineer =
    engineerData.find((e) => e.name === selectedEngineer) || engineerData[0];

  // Handle period change
  const handlePeriodChange = async (newPeriod: DateRange) => {
    console.log("�� Period change triggered:", {
      oldPeriod: selectedPeriod.label,
      newPeriod: newPeriod.label,
      newStart: newPeriod.start.toISOString(),
      newEnd: newPeriod.end.toISOString(),
      tableName: newPeriod.tableName,
    });

    setSelectedPeriod(newPeriod);
    console.log(`🔄 Calling refetch with new period (${newPeriod.tableName})...`);
    await refetch(newPeriod);
    console.log("✅ Refetch completed");
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
            <div>
              ✓ VITE_SUPABASE_URL: {config.hasSupabaseUrl ? "Set" : "Missing"}
            </div>
            <div>
              ✓ VITE_SUPABASE_ANON_KEY:{" "}
              {config.hasSupabaseKey ? "Set" : "Missing"}
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
              Your database is set up but doesn't contain any metrics for the
              selected period.
            </p>
            <p className="mb-3">
              Try selecting a different date range, or run 'npm run
              sync:incremental' in terminal to sync last 30 days.
            </p>
          </div>
          <button
            onClick={async () => {
              const result = await syncData();
              if (result.success) {
                console.log("Initial sync completed successfully:", result);
              } else {
                console.error("Initial sync failed:", result.errors);
              }
            }}
            disabled={isSyncing}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 mx-auto"
          >
            <RefreshCw
              className={cn("w-4 h-4 text-white", isSyncing && "animate-spin")}
            />
            <span>
              {isSyncing ? "Syncing from Zendesk..." : "Sync Data (Use CLI)"}
            </span>
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
            <h2 className="text-lg font-semibold">Error Loading Data</h2>
          </div>
          <div className="text-gray-600 mb-4">
            {isCloudError ? (
              <div>
                <p className="mb-3">
                  Unable to load data from the database. Please check your
                  connection and try again.
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
              Retry Connection
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

  // Function to fetch CES score details
  const fetchCESDetails = async (engineerName: string) => {
    setModalLoading(true);
    try {
      const { supabase } = await import("../lib/supabase");
      const startDate = selectedPeriod.start.toISOString().split("T")[0];
      const endDate = selectedPeriod.end.toISOString().split("T")[0];

      // Get engineer's Zendesk ID
      const engineerZendeskId = nameToIdMap.get(engineerName);
      if (!engineerZendeskId) {
        throw new Error(`Engineer ${engineerName} not found in mapping`);
      }

      console.log(`🔍 Fetching CES details from Supabase for ${engineerName} (ID: ${engineerZendeskId})`);
      console.log(`📅 Date range: ${startDate} to ${endDate}`);

      // Special debugging for Akash Singh
      if (engineerName === "Akash Singh") {
        console.log(`🎯 DEBUGGING AKASH SINGH SPECIFICALLY:`);
        console.log(`   - Engineer Name: ${engineerName}`);
        console.log(`   - Zendesk ID: ${engineerZendeskId}`);
        console.log(`   - Date Range: ${startDate} to ${endDate}`);
        console.log(`   - nameToIdMap has Akash:`, nameToIdMap.has("Akash Singh"));
        console.log(`   - Full nameToIdMap:`, Array.from(nameToIdMap.entries()));

        // Check what assignee_ids actually exist in the database
        console.log(`🎯 CHECKING WHAT ASSIGNEE IDS EXIST IN DATABASE...`);
        try {
          const { data: uniqueAssignees, error: assigneeError } = await supabase
            .from('tickets')
            .select('assignee_id')
            .not('assignee_id', 'is', null)
            .limit(1000);

          if (!assigneeError && uniqueAssignees) {
            const uniqueIds = [...new Set(uniqueAssignees.map(t => t.assignee_id))];
            console.log(`   - Unique assignee IDs in database (first 20):`, uniqueIds.slice(0, 20));
            console.log(`   - Looking for Akash's ID: ${engineerZendeskId}`);
            console.log(`   - Is Akash's ID in database?`, uniqueIds.includes(engineerZendeskId));
            console.log(`   - Total unique assignee IDs: ${uniqueIds.length}`);
          }
        } catch (err) {
          console.error('Error checking assignee IDs:', err);
        }
      }

      // First, let's check if this engineer has any tickets at all
      const { data: allTickets, error: allError } = await supabase
        .from('tickets')
        .select('zendesk_id, subject, status, created_at, updated_at, solved_at, assignee_id')
        .eq('assignee_id', engineerZendeskId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (allError) {
        console.error('❌ Error fetching all tickets:', allError);
      } else {
        console.log(`📊 Found ${allTickets?.length || 0} total tickets for ${engineerName} (all time)`);
        console.log('📋 Sample tickets:', allTickets?.slice(0, 3).map(t => ({
          id: t.zendesk_id,
          subject: t.subject?.substring(0, 50) + '...',
          status: t.status,
          created: t.created_at?.split('T')[0]
        })));

        // Special debugging for Akash Singh
        if (engineerName === "Akash Singh") {
          console.log(`🎯 AKASH ALL-TIME TICKETS DEBUG:`);
          console.log(`   - Total tickets found (all time): ${allTickets?.length || 0}`);
          if (allTickets && allTickets.length > 0) {
            console.log(`   - Date range of tickets:`, {
              oldest: allTickets[allTickets.length - 1]?.created_at,
              newest: allTickets[0]?.created_at
            });
            console.log(`   - All ticket IDs:`, allTickets.map(t => t.zendesk_id));
          } else {
            console.log(`   - ❌ NO TICKETS FOUND FOR AKASH AT ALL!`);
            console.log(`   - This suggests either:`);
            console.log(`     1. Wrong Zendesk ID (${engineerZendeskId})`);
            console.log(`     2. No tickets assigned to this ID in database`);
            console.log(`     3. Database connection issue`);
          }
        }
      }

      // Fetch tickets assigned to this engineer in the date range
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('zendesk_id, subject, status, created_at, updated_at, solved_at, custom_fields')
        .eq('assignee_id', engineerZendeskId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      console.log(`📊 Found ${tickets?.length || 0} tickets in date range for ${engineerName}`);

      // Special debugging for Akash Singh
      if (engineerName === "Akash Singh") {
        console.log(`🎯 AKASH DEBUGGING - Tickets query result:`);
        console.log(`   - Tickets found: ${tickets?.length || 0}`);
        console.log(`   - Query details: assignee_id = ${engineerZendeskId}, created_at >= ${startDate}, created_at <= ${endDate}`);
        if (tickets && tickets.length > 0) {
          console.log(`   - Sample tickets:`, tickets.slice(0, 3).map(t => ({
            zendesk_id: t.zendesk_id,
            subject: t.subject?.substring(0, 50),
            created_at: t.created_at,
            assignee_id: t.assignee_id
          })));
        }
      }

      // Show all tickets for this engineer, whether they have CES scores or not
      const allTicketsForPeriod = tickets?.map(ticket => {
        const cesField = ticket.custom_fields?.find(field => field.id === 31797439524887);
        let score = null;

        if (cesField && cesField.value !== null) {
          const parsedScore = typeof cesField.value === 'string' ? parseFloat(cesField.value) : Number(cesField.value);
          if (!isNaN(parsedScore) && parsedScore >= 1 && parsedScore <= 7) {
            score = parsedScore;
          }
        }

        return {
          ticketId: ticket.zendesk_id,
          subject: ticket.subject || 'No subject',
          score: score,
          date: new Date(ticket.created_at).toLocaleDateString('en-GB'),
          status: ticket.status
        };
      }) || [];

      console.log(`📊 All tickets for period:`, allTicketsForPeriod.slice(0, 5));

      // Separate tickets with CES scores from those without
      const ticketsWithCES = allTicketsForPeriod.filter(t => t.score !== null);
      const ticketsWithoutCES = allTicketsForPeriod.filter(t => t.score === null);

      console.log(`📊 Tickets with CES: ${ticketsWithCES.length}, without CES: ${ticketsWithoutCES.length}`);

      // Categorize CES tickets by score
      const highScoring = ticketsWithCES.filter(t => t.score >= 6);
      const averageScoring = ticketsWithCES.filter(t => t.score >= 4 && t.score < 6);
      const lowScoring = ticketsWithCES.filter(t => t.score < 4);

      const cesData = {
        highScoring: highScoring.slice(0, 10),
        averageScoring: averageScoring.slice(0, 10),
        lowScoring: lowScoring.slice(0, 10),
        ticketsWithoutCES: ticketsWithoutCES.slice(0, 10), // Show tickets without CES scores
        totalTickets: ticketsWithCES.length,
        totalAllTickets: allTicketsForPeriod.length,
        engineerName,
        period: selectedPeriod.label
      };

      console.log(`📊 Final CES data:`, {
        high: cesData.highScoring.length,
        average: cesData.averageScoring.length,
        low: cesData.lowScoring.length,
        withoutCES: cesData.ticketsWithoutCES.length,
        total: cesData.totalTickets
      });

      setModalData(cesData);
    } catch (error) {
      console.error("Failed to fetch CES details from Supabase:", error);
      setModalData({
        error: `Failed to load CES details: ${error.message}`,
        engineerName,
        period: selectedPeriod.label
      });
    } finally {
      setModalLoading(false);
    }
  };

  // Function to fetch survey response details
  const fetchSurveyDetails = async (engineerName: string) => {
    setModalLoading(true);
    try {
      const { supabase } = await import("../lib/supabase");
      const startDate = selectedPeriod.start.toISOString().split("T")[0];
      const endDate = selectedPeriod.end.toISOString().split("T")[0];

      // Get engineer's Zendesk ID
      const engineerZendeskId = nameToIdMap.get(engineerName);
      if (!engineerZendeskId) {
        throw new Error(`Engineer ${engineerName} not found in mapping`);
      }

      console.log(`🔍 Fetching survey responses for ${engineerName} (ID: ${engineerZendeskId})`);

      // Fetch tickets for this engineer (remove date/status restrictions temporarily)
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('zendesk_id, subject, status, created_at, updated_at, solved_at, custom_fields')
        .eq('assignee_id', engineerZendeskId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Extract survey responses from custom fields
      const CES_FIELD_ID = 31797439524887;

      // Debug custom fields structure
      if (tickets && tickets.length > 0) {
        console.log(`🔍 Sample ticket custom_fields:`, tickets[0].custom_fields);
        console.log(`🔍 Looking for CES field ID: ${CES_FIELD_ID}`);

        // Check all custom field IDs in first few tickets
        const allFieldIds = new Set();
        tickets.slice(0, 5).forEach(ticket => {
          ticket.custom_fields?.forEach(field => {
            allFieldIds.add(field.id);
          });
        });
        console.log(`🔍 All custom field IDs found:`, Array.from(allFieldIds));
      }

      const surveyResponses = tickets
        ?.map(ticket => {
          const cesField = ticket.custom_fields?.find(field => field.id === CES_FIELD_ID);

          // Debug specific field search
          if (engineerName === "Akash Singh" && ticket.custom_fields) {
            console.log(`🎯 Ticket ${ticket.zendesk_id} custom fields:`, ticket.custom_fields.map(f => ({ id: f.id, value: f.value })));
          }

          if (cesField && cesField.value !== null) {
            const rating = typeof cesField.value === 'string' ? parseFloat(cesField.value) : Number(cesField.value);
            if (!isNaN(rating) && rating >= 1 && rating <= 7) {
              console.log(`✅ Found CES rating ${rating} for ticket ${ticket.zendesk_id}`);
              return {
                ticketId: ticket.zendesk_id,
                subject: ticket.subject || 'No subject',
                responseDate: new Date(ticket.solved_at || ticket.updated_at).toLocaleDateString('en-GB'),
                rating: rating
              };
            } else {
              console.log(`❌ Invalid CES rating ${rating} for ticket ${ticket.zendesk_id}`);
            }
          }
          return null;
        })
        .filter(Boolean) || [];

      console.log(`📊 Found ${surveyResponses.length} survey responses for ${engineerName}`);
      console.log(`📋 Sample survey responses:`, surveyResponses.slice(0, 3));
      console.log(`📊 Total tickets found: ${tickets?.length || 0}`);

      const surveyData = {
        responses: surveyResponses,
        totalResponses: surveyResponses.length,
        averageRating: surveyResponses.length > 0
          ? (surveyResponses.reduce((sum, r) => sum + r.rating, 0) / surveyResponses.length).toFixed(1)
          : 0,
        engineerName,
        period: selectedPeriod.label
      };

      console.log(`📊 Final survey data:`, surveyData);

      setModalData(surveyData);
    } catch (error) {
      console.error("Failed to fetch survey details:", error);
      setModalData({ error: "Failed to load survey details" });
    } finally {
      setModalLoading(false);
    }
  };

  // Function to fetch enterprise ticket details
  const fetchEnterpriseDetails = async (engineerName: string) => {
    setModalLoading(true);
    try {
      const { supabase } = await import("../lib/supabase");
      const startDate = selectedPeriod.start.toISOString().split("T")[0];
      const endDate = selectedPeriod.end.toISOString().split("T")[0];

      // Get engineer's Zendesk ID
      const engineerZendeskId = nameToIdMap.get(engineerName);
      if (!engineerZendeskId) {
        throw new Error(`Engineer ${engineerName} not found in mapping`);
      }

      console.log(`🔍 Fetching enterprise tickets for ${engineerName} (ID: ${engineerZendeskId})`);
      console.log(`📅 Date range: ${startDate} to ${endDate}`);

      // Fetch ALL tickets for this engineer first (remove restrictions)
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('zendesk_id, subject, status, created_at, updated_at, solved_at, tags, custom_fields, requester_id')
        .eq('assignee_id', engineerZendeskId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      console.log(`📊 Found ${tickets?.length || 0} total tickets for ${engineerName}`);

      // Debug tags structure
      if (tickets && tickets.length > 0) {
        console.log(`🔍 Sample ticket tags:`, tickets[0].tags);
        console.log(`🔍 Sample ticket custom_fields:`, tickets[0].custom_fields?.slice(0, 3));
      }

      // Filter for enterprise tickets (look for enterprise tags or indicators)
      const enterpriseTickets = tickets
        ?.filter(ticket => {
          const tags = ticket.tags || [];
          const hasEnterpriseTag = tags.some(tag =>
            tag.toLowerCase().includes('enterprise') ||
            tag.toLowerCase().includes('ent_') ||
            tag.toLowerCase().includes('premium') ||
            tag.toLowerCase().includes('business')
          );

          // You can also check custom fields for enterprise indicators
          const hasEnterpriseCustomField = ticket.custom_fields?.some(field => {
            if (typeof field.value === 'string') {
              return field.value.toLowerCase().includes('enterprise');
            }
            return false;
          });

          // Debug for first few tickets
          if (tickets.indexOf(ticket) < 5) {
            console.log(`🎫 Ticket ${ticket.zendesk_id}:`, {
              tags: tags,
              hasEnterpriseTag,
              hasEnterpriseCustomField
            });
          }

          return hasEnterpriseTag || hasEnterpriseCustomField;
        })
        .map(ticket => ({
          ticketId: ticket.zendesk_id,
          subject: ticket.subject || 'No subject',
          closedDate: new Date(ticket.solved_at || ticket.updated_at).toLocaleDateString('en-GB'),
          tags: ticket.tags || [],
          requesterId: ticket.requester_id
        })) || [];

      console.log(`📊 Found ${enterpriseTickets.length} enterprise tickets for ${engineerName}`);

      // If no enterprise tickets found, show recent tickets as fallback
      let ticketsToShow = enterpriseTickets;
      let isEnterpriseData = true;

      if (enterpriseTickets.length === 0 && tickets && tickets.length > 0) {
        console.log(`⚠️ No enterprise tickets found, showing recent tickets as fallback`);
        ticketsToShow = tickets.slice(0, 10).map(ticket => ({
          ticketId: ticket.zendesk_id,
          subject: ticket.subject || 'No subject',
          closedDate: new Date(ticket.created_at).toLocaleDateString('en-GB'),
          tags: ticket.tags || [],
          requesterId: ticket.requester_id
        }));
        isEnterpriseData = false;
      }

      const enterpriseData = {
        tickets: ticketsToShow.slice(0, 20), // Show top 20
        totalTickets: isEnterpriseData ? enterpriseTickets.length : tickets?.length || 0,
        isActualEnterpriseData: isEnterpriseData,
        engineerName,
        period: selectedPeriod.label
      };

      setModalData(enterpriseData);
    } catch (error) {
      console.error("Failed to fetch enterprise details:", error);
      setModalData({ error: "Failed to load enterprise details" });
    } finally {
      setModalLoading(false);
    }
  };

  // Handle card click
  const handleCardClick = async (cardType: string, engineerName: string) => {
    setActiveModal(cardType);
    setModalData(null);

    switch (cardType) {
      case "ces":
        await fetchCESDetails(engineerName);
        break;
      case "survey":
        await fetchSurveyDetails(engineerName);
        break;
      case "enterprise":
        await fetchEnterpriseDetails(engineerName);
        break;
    }
  };

  // PDF export function for recommendations
  const exportRecommendationsToPDF = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF();

      // Set up the document
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      const lineHeight = 7;
      let currentY = 30;

      // Header
      doc.setFontSize(20);
      doc.setFont(undefined, "bold");
      doc.text("Monthly Performance Recommendations", margin, currentY);

      currentY += 15;
      doc.setFontSize(12);
      doc.setFont(undefined, "normal");
      doc.text(`Period: ${selectedPeriod.label}`, margin, currentY);
      doc.text(
        `Generated: ${new Date().toLocaleDateString("en-GB")}`,
        pageWidth - 60,
        currentY,
      );

      currentY += 20;

      // Company branding
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Builder.io Support Team Performance Report", margin, currentY);

      currentY += 20;
      doc.setTextColor(0, 0, 0);

      // Recommendations section
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text("Recommendations for Next Month", margin, currentY);
      currentY += 15;

      // Training Focus
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.setTextColor(31, 81, 255); // Blue color
      doc.text("1. Training Focus", margin, currentY);
      currentY += 8;

      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      doc.setTextColor(0, 0, 0);
      const trainingText =
        "Implement advanced customer communication workshops for engineers with CES scores below 85%";
      const trainingLines = doc.splitTextToSize(
        trainingText,
        pageWidth - 2 * margin,
      );
      doc.text(trainingLines, margin + 5, currentY);
      currentY += trainingLines.length * lineHeight + 10;

      // Process Improvement
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.setTextColor(34, 197, 94); // Green color
      doc.text("2. Process Improvement", margin, currentY);
      currentY += 8;

      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      doc.setTextColor(0, 0, 0);
      const processText =
        "Deploy new knowledge base tools to reduce average response time by 15%";
      const processLines = doc.splitTextToSize(
        processText,
        pageWidth - 2 * margin,
      );
      doc.text(processLines, margin + 5, currentY);
      currentY += processLines.length * lineHeight + 10;

      // Team Development
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.setTextColor(147, 51, 234); // Purple color
      doc.text("3. Team Development", margin, currentY);
      currentY += 8;

      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      doc.setTextColor(0, 0, 0);
      const teamText =
        "Establish peer mentoring program to share best practices across the team";
      const teamLines = doc.splitTextToSize(teamText, pageWidth - 2 * margin);
      doc.text(teamLines, margin + 5, currentY);
      currentY += teamLines.length * lineHeight + 15;

      // Key metrics summary
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text("Current Performance Metrics", margin, currentY);
      currentY += 15;

      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      const totalTickets =
        engineerData.length > 0
          ? engineerData.reduce((sum, eng) => sum + eng.closed, 0)
          : 0;
      const avgCES = averageMetrics
        ? averageMetrics.cesPercent.toFixed(1)
        : "0.0";
      const avgResponseTime = averageMetrics
        ? averageMetrics.avgPcc.toFixed(1)
        : "0.0";

      doc.text(
        `• Total Tickets Resolved: ${totalTickets}`,
        margin + 5,
        currentY,
      );
      currentY += lineHeight;
      doc.text(`• Average CES Score: ${avgCES}%`, margin + 5, currentY);
      currentY += lineHeight;
      doc.text(
        `• Average Response Time: ${avgResponseTime} hours`,
        margin + 5,
        currentY,
      );
      currentY += lineHeight + 10;

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        "This report is generated by Builder.io Support Performance Dashboard",
        margin,
        doc.internal.pageSize.height - 20,
      );
      doc.text(
        `Generated on ${new Date().toLocaleString()}`,
        margin,
        doc.internal.pageSize.height - 13,
      );

      // Save the PDF
      const fileName = `recommendations-${selectedPeriod.value}-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      // Show success message
      alert(`✅ Recommendations exported successfully!\n\nFile: ${fileName}`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("❌ Failed to export PDF. Please try again.");
    }
  };

  // Copy key achievements to clipboard
  const copyKeyAchievements = async () => {
    try {
      const achievementsText = `Key Achievements - ${selectedPeriod.label}
Generated: ${new Date().toLocaleDateString("en-GB")}

✅ Excellent Team Performance
${engineerData.filter((e) => e.cesPercent >= 85).length} engineers achieved CES scores above 85%

✅ High Resolution Rate
Successfully resolved ${engineerData.length > 0 ? engineerData.reduce((sum, eng) => sum + eng.closed, 0) : 0} tickets this period

✅ Quality Consistency
Maintained high quality standards across all support channels

---
Builder.io Support Team Performance Report`;

      await navigator.clipboard.writeText(achievementsText);
      alert("✅ Key achievements copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      alert("❌ Failed to copy to clipboard. Please try again.");
    }
  };

  // Copy recommendations to clipboard
  const copyRecommendations = async () => {
    try {
      const recommendationsText = `Recommendations for Next Month - ${selectedPeriod.label}
Generated: ${new Date().toLocaleDateString("en-GB")}

�� Training Focus
Implement advanced customer communication workshops for engineers with CES scores below 85%

🔧 Process Improvement
Deploy new knowledge base tools to reduce average response times

📊 Quality Enhancement
Continue focus on rapid resolution while maintaining customer satisfaction standards

---
Builder.io Support Team Performance Report`;

      await navigator.clipboard.writeText(recommendationsText);
      alert("✅ Recommendations copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      alert("❌ Failed to copy to clipboard. Please try again.");
    }
  };

  // Modal component
  const DetailsModal = () => {
    if (!activeModal || !modalData) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-lg font-semibold">
              {activeModal === "ces" && "CES Score Details"}
              {activeModal === "survey" && "Survey Response Details"}
              {activeModal === "enterprise" && "Enterprise Tickets Closed"}
            </h3>
            <button
              onClick={() => setActiveModal(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {modalLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2">Loading details...</span>
              </div>
            ) : modalData.error ? (
              <div className="text-center py-8 text-red-600">
                {modalData.error}
              </div>
            ) : (
              <div>
                {activeModal === "ces" && (
                  <div className="space-y-6">
                    {modalData.totalTickets !== undefined && (
                      <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <h4 className="font-medium text-blue-900 mb-2">
                          CES Data Summary for {modalData.engineerName}
                        </h4>
                        <div className="text-sm text-blue-800">
                          <p>Period: {modalData.period}</p>
                          <p>Total tickets in period: {modalData.totalAllTickets || 0}</p>
                          <p>Tickets with CES scores: {modalData.totalTickets}</p>
                          <p>High scoring (6-7): {modalData.highScoring?.length || 0}</p>
                          <p>Average scoring (4-5): {modalData.averageScoring?.length || 0}</p>
                          <p>Low scoring (1-3): {modalData.lowScoring?.length || 0}</p>
                          <p>Without CES scores: {modalData.ticketsWithoutCES?.length || 0}</p>
                        </div>
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-green-800 mb-3">
                        High Scoring Tickets (6-7 CES)
                      </h4>
                      <div className="space-y-2">
                        {modalData.highScoring?.map((ticket: any) => (
                          <div
                            key={ticket.ticketId}
                            className="p-3 bg-green-50 rounded border-l-4 border-green-500"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium">
                                  {ticket.ticketId}
                                </span>
                                <span className="ml-2 text-sm text-gray-600">
                                  {ticket.subject}
                                </span>
                              </div>
                              <span className="bg-green-600 text-white px-2 py-1 rounded text-sm">
                                {ticket.score}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-yellow-800 mb-3">
                        Average Scoring Tickets (4 CES)
                      </h4>
                      <div className="space-y-2">
                        {modalData.averageScoring?.map((ticket: any) => (
                          <div
                            key={ticket.ticketId}
                            className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-500"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium">
                                  {ticket.ticketId}
                                </span>
                                <span className="ml-2 text-sm text-gray-600">
                                  {ticket.subject}
                                </span>
                              </div>
                              <span className="bg-yellow-600 text-white px-2 py-1 rounded text-sm">
                                {ticket.score}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-red-800 mb-3">
                        Low Scoring Tickets (1-3 CES)
                      </h4>
                      <div className="space-y-2">
                        {modalData.lowScoring?.map((ticket: any) => (
                          <div
                            key={ticket.ticketId}
                            className="p-3 bg-red-50 rounded border-l-4 border-red-500"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium">
                                  {ticket.ticketId}
                                </span>
                                <span className="ml-2 text-sm text-gray-600">
                                  {ticket.subject}
                                </span>
                              </div>
                              <span className="bg-red-600 text-white px-2 py-1 rounded text-sm">
                                {ticket.score}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {modalData.ticketsWithoutCES && modalData.ticketsWithoutCES.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-3">
                          Tickets Without CES Scores
                        </h4>
                        <div className="space-y-2">
                          {modalData.ticketsWithoutCES.map((ticket: any) => (
                            <div
                              key={ticket.ticketId}
                              className="p-3 bg-gray-50 rounded border-l-4 border-gray-400"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-medium">
                                    #{ticket.ticketId}
                                  </span>
                                  <span className="ml-2 text-sm text-gray-600">
                                    {ticket.subject}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="bg-gray-500 text-white px-2 py-1 rounded text-sm">
                                    No CES
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {ticket.status}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Created: {ticket.date}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeModal === "survey" && (
                  <div>
                    {modalData.totalResponses !== undefined && (
                      <div className="bg-purple-50 p-4 rounded-lg mb-4">
                        <h4 className="font-medium text-purple-900 mb-2">
                          Survey Response Summary for {modalData.engineerName}
                        </h4>
                        <div className="text-sm text-purple-800">
                          <p>Period: {modalData.period}</p>
                          <p>Total survey responses: {modalData.totalResponses}</p>
                          <p>Average rating: {modalData.averageRating}/7</p>
                        </div>
                      </div>
                    )}
                    <h4 className="font-medium mb-3">
                      Tickets with Survey Responses ({modalData.totalResponses || 0} found)
                    </h4>
                    {modalData.responses && modalData.responses.length > 0 ? (
                      <div className="space-y-2">
                        {modalData.responses.map((response: any) => (
                          <div
                            key={response.ticketId}
                            className="p-3 bg-blue-50 rounded border-l-4 border-blue-500"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-bold text-blue-900">
                                  Ticket #{response.ticketId}
                                </div>
                                <div className="text-sm text-gray-700 mt-1 font-medium">
                                  {response.subject}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Survey Date: {response.responseDate}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-medium">
                                  {response.rating}/7
                                </span>
                                <div className="text-xs text-gray-500 mt-1">
                                  {response.rating >= 5 ? 'Good' : response.rating >= 4 ? 'Average' : 'Poor'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-8 bg-gray-50 rounded-lg">
                        <div className="text-gray-500 mb-2">No Survey Responses Found</div>
                        <div className="text-sm text-gray-400">
                          No tickets with survey responses in the selected period.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeModal === "enterprise" && (
                  <div>
                    {modalData.totalTickets !== undefined && (
                      <div className="bg-red-50 p-4 rounded-lg mb-4">
                        <h4 className="font-medium text-red-900 mb-2">
                          Enterprise Tickets Summary for {modalData.engineerName}
                        </h4>
                        <div className="text-sm text-red-800">
                          <p>Period: {modalData.period}</p>
                          <p>Total {modalData.isActualEnterpriseData ? 'enterprise' : 'recent'} tickets: {modalData.totalTickets}</p>
                          {!modalData.isActualEnterpriseData && (
                            <p className="text-amber-700 mt-1">⚠️ No enterprise tags found, showing recent tickets</p>
                          )}
                        </div>
                      </div>
                    )}
                    <h4 className="font-medium mb-3">
                      {modalData.isActualEnterpriseData ? 'Enterprise Tickets' : 'Recent Tickets'} ({modalData.tickets?.length || 0} found)
                    </h4>
                    <div className="space-y-2">
                      {modalData.tickets?.map((ticket: any) => (
                        <div
                          key={ticket.ticketId}
                          className="p-3 bg-red-50 rounded border-l-4 border-red-500"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">
                                {ticket.ticketId}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {ticket.subject}
                              </div>
                              {ticket.tags && ticket.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {ticket.tags.slice(0, 3).map((tag: string, index: number) => (
                                    <span key={index} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-sm text-gray-500 ml-4">
                              Closed: {ticket.closedDate}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Details Modal */}
      <DetailsModal />

      {/* Loading/Syncing Overlay */}
      {(isLoading || isSyncing) && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center space-y-3 min-w-[300px]">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-gray-700">
                {isSyncing ? "Syncing data from Zendesk..." : "Loading data..."}
              </span>
            </div>
            {syncProgress && (
              <div className="w-full">
                <div className="text-sm text-gray-600 mb-1">
                  {syncProgress.message}
                </div>
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
              <div className="text-gray-900 text-lg font-normal leading-7 pl-2">
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
                  console.log(
                    "🔄 Manual refresh triggered with current period:",
                    selectedPeriod.label,
                  );
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
                    console.log("Sync completed successfully:", result);
                  } else {
                    console.error("Sync failed:", result.errors);
                  }
                }}
                disabled={isLoading || isSyncing}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
                title="Sync last 30 days of data from Zendesk to database (run via CLI)"
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 text-white",
                    (isLoading || isSyncing) && "animate-spin",
                  )}
                />
                <span className="text-sm font-medium">
                  {isSyncing ? "Syncing..." : "Sync Last 30 Days (CLI)"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Debug Panel - only in development */}
      {DEBUG_MODE && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <details className="text-sm">
              <summary className="cursor-pointer text-orange-800 font-medium flex items-center">
                🔍 Debug Info (Click to expand)
              </summary>
              <div className="mt-2 space-y-1 text-orange-700">
                <div>Engineers loaded: {engineerData.length}</div>
                <div>
                  Average metrics:{" "}
                  {averageMetrics ? "✅ Loaded" : "❌ Not loaded"}
                </div>
                <div>
                  Loading: {isLoading ? "⏳ In progress" : "✅ Complete"}
                </div>
                <div>
                  Syncing: {isSyncing ? "⏳ In progress" : "✅ Complete"}
                </div>
                <div>
                  Connection: {navigator.onLine ? "🌐 Online" : "📴 Offline"}
                </div>
                <div>
                  Mode:{" "}
                  {(() => {
                    const hasSupabaseUrl = !!import.meta.env.VITE_SUPABASE_URL;
                    const hasSupabaseKey = !!import.meta.env
                      .VITE_SUPABASE_ANON_KEY;
                    if (!hasSupabaseUrl || !hasSupabaseKey)
                      return "⚠�� Not Configured";
                    if (!navigator.onLine) return "📶 Offline";
                    if (engineerData.length > 0 && !error)
                      return "✅ Live Data";
                    return error ? "❌ Error" : "🔄 Loading";
                  })()}
                </div>
                <div>Error: {error || "None"}</div>
                <div>
                  Last updated: {lastUpdated?.toLocaleString() || "Never"}
                </div>
                <div>
                  Database state:{" "}
                  {engineerData.length > 0 ? "✅ Has data" : "❌ Empty"}
                </div>
                <div>Selected period: {selectedPeriod.label}</div>
                <div>
                  Date range: {selectedPeriod.start.toISOString().split("T")[0]}{" "}
                  to {selectedPeriod.end.toISOString().split("T")[0]}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      console.log("🔄 Reloading data...");
                      try {
                        await refetch(selectedPeriod);
                        alert(
                          `✅ Data reloaded successfully for ${selectedPeriod.label}`,
                        );
                      } catch (error) {
                        console.error("❌ Data reload failed:", error);
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        alert(
                          `❌ Failed to reload data: ${errorMessage}\n\nCheck console for details.`,
                        );
                      }
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    Reload Data
                  </button>

                  <button
                    onClick={() => {
                      const hasSupabaseUrl = !!import.meta.env
                        .VITE_SUPABASE_URL;
                      const hasSupabaseKey = !!import.meta.env
                        .VITE_SUPABASE_ANON_KEY;
                      const isOnline = navigator.onLine;

                      let status = "📊 Live Data Mode";
                      let details =
                        "Application is fetching real data from Supabase.\n\n";

                      if (!hasSupabaseUrl || !hasSupabaseKey) {
                        details += "��� Supabase credentials not configured\n";
                      } else {
                        details += "✅ Supabase credentials configured\n";
                      }

                      if (!isOnline) {
                        details += "❌ Browser is offline\n";
                      } else {
                        details += "��� Browser is online\n";
                      }

                      details +=
                        "\n���� All features are working with live data!\n";
                      details +=
                        "📊 Engineer metrics, comparisons, and exports are fully functional.";

                      alert(`${status}\n\n${details}`);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Connection Status
                  </button>

                  <button
                    onClick={async () => {
                      console.log("🩺 Running comprehensive diagnostics...");
                      try {
                        const diagnostics = {
                          environment: {
                            supabaseUrl: import.meta.env.VITE_SUPABASE_URL
                              ? "Set"
                              : "Missing",
                            supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY
                              ? "Set"
                              : "Missing",
                            isDev: import.meta.env.DEV,
                            mode: import.meta.env.MODE,
                          },
                          network: {},
                          database: {},
                        };

                        // Test database connection
                        const { testSupabaseConnection } = await import(
                          "../lib/supabase"
                        );
                        const connectionResult = await testSupabaseConnection();
                        diagnostics.database.connection =
                          connectionResult.success
                            ? "Success"
                            : connectionResult.error;

                        console.log("🩺 Diagnostics results:", diagnostics);

                        const report =
                          `🩺 Supabase Diagnostics Report:\n\n` +
                          `Environment:\n` +
                          `�� URL: ${diagnostics.environment.supabaseUrl}\n` +
                          `• Key: ${diagnostics.environment.supabaseKey}\n` +
                          `• Mode: ${diagnostics.environment.mode}\n\n` +
                          `Database:\n` +
                          `• Connection: ${diagnostics.database.connection}`;

                        alert(report);
                      } catch (error) {
                        console.error("❌ Diagnostics failed:", error);
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        alert(`❌ Diagnostics failed: ${errorMessage}`);
                      }
                    }}
                    className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                  >
                    Run Diagnostics
                  </button>

                  <button
                    onClick={async () => {
                      console.log(
                        "📅 Testing current date range with real data...",
                      );
                      try {
                        const { supabase } = await import("../lib/supabase");

                        const startDate = selectedPeriod.start
                          .toISOString()
                          .split("T")[0];
                        const endDate = selectedPeriod.end
                          .toISOString()
                          .split("T")[0];

                        const { data: tickets, error } = await supabase
                          .from("tickets")
                          .select("zendesk_id, status, assignee_id, created_at")
                          .gte("created_at", startDate)
                          .lte("created_at", endDate)
                          .limit(10);

                        if (error) throw error;

                        console.log(
                          "📅 Real tickets for range:",
                          tickets?.length || 0,
                        );
                        console.log(
                          "📝 Sample ticket data:",
                          tickets?.slice(0, 3),
                        );

                        alert(
                          `✅ Found ${tickets?.length || 0} tickets for ${selectedPeriod.label}\n\nDate Range: ${startDate} to ${endDate}`,
                        );
                      } catch (error) {
                        console.error("❌ Date range query failed:", error);
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        alert(`❌ Query failed: ${errorMessage}`);
                      }
                    }}
                    className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                  >
                    Debug Date Range
                  </button>

                  <button
                    onClick={async () => {
                      if (debugLoading) return; // Prevent multiple clicks
                      setDebugLoading(true);
                      console.log("🎯 Checking Parth's real data...");
                      try {
                        // Check what the processed metrics show for Parth
                        const parthInMetrics = engineerData.find(
                          (e) => e.name === "Parth Sharma",
                        );
                        console.log("📊 Processed metrics for Parth:", {
                          name: parthInMetrics?.name,
                          closed: parthInMetrics?.closed,
                          surveyCount: parthInMetrics?.surveyCount,
                          cesPercent: parthInMetrics?.cesPercent,
                          open: parthInMetrics?.open,
                        });

                        // Fetch real ticket data for Parth
                        const { supabase } = await import("../lib/supabase");
                        const parthId = 29092389569431; // Parth Sharma's Zendesk ID

                        const startDate = selectedPeriod.start
                          .toISOString()
                          .split("T")[0];
                        const endDate = selectedPeriod.end
                          .toISOString()
                          .split("T")[0];

                        const { data: tickets, error } = await supabase
                          .from("tickets")
                          .select(
                            "zendesk_id, status, assignee_id, created_at, subject",
                          )
                          .eq("assignee_id", parthId)
                          .gte("created_at", startDate)
                          .lte("created_at", endDate)
                          .limit(20);

                        if (error) throw error;

                        const closedTickets =
                          tickets?.filter(
                            (t) =>
                              t.status === "closed" || t.status === "solved",
                          ) || [];

                        console.log(`🎯 Real data for Parth:`, {
                          totalTickets: tickets?.length || 0,
                          closedTickets: closedTickets.length,
                          period: selectedPeriod.label,
                        });

                        // Show status breakdown
                        const statusBreakdown = (tickets || []).reduce(
                          (acc, t) => {
                            acc[t.status] = (acc[t.status] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>,
                        );
                        console.log(
                          `🎯 Parth's ticket status breakdown:`,
                          statusBreakdown,
                        );

                        const metricsData = parthInMetrics?.closed || 0;
                        const realData = closedTickets.length;

                        alert(
                          `📊 Parth Sharma Real Data (${selectedPeriod.label}):\n\n` +
                            `Dashboard Metrics: ${metricsData} closed tickets\n` +
                            `Database Tickets: ${realData} closed tickets\n` +
                            `Total tickets: ${tickets?.length || 0}\n` +
                            `Survey Count: ${parthInMetrics?.surveyCount || 0}\n` +
                            `CES: ${parthInMetrics?.cesPercent?.toFixed(1) || 0}%\n\n` +
                            `Status Breakdown: ${Object.entries(statusBreakdown)
                              .map(([status, count]) => `${status}: ${count}`)
                              .join(", ")}`,
                        );
                      } catch (error) {
                        console.error("❌ Parth data check failed:", error);
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        alert(
                          `❌ Failed to fetch Parth's data: ${errorMessage}`,
                        );
                      } finally {
                        setDebugLoading(false);
                      }
                    }}
                    disabled={debugLoading}
                    className={cn(
                      "px-3 py-1 text-white text-xs rounded",
                      debugLoading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700",
                    )}
                  >
                    {debugLoading ? "Loading..." : "Parth's Tickets"}
                  </button>

                  <button
                    onClick={async () => {
                      console.log("🎯 Checking real ticket status...");
                      try {
                        const { supabase } = await import("../lib/supabase");

                        const startDate = selectedPeriod.start
                          .toISOString()
                          .split("T")[0];
                        const endDate = selectedPeriod.end
                          .toISOString()
                          .split("T")[0];

                        const { data: tickets, error } = await supabase
                          .from("tickets")
                          .select(
                            "zendesk_id, status, assignee_id, created_at, subject",
                          )
                          .gte("created_at", startDate)
                          .lte("created_at", endDate)
                          .limit(50);

                        if (error) throw error;

                        console.log(
                          "🎯 Real recent tickets:",
                          tickets?.map((t) => ({
                            id: t.zendesk_id,
                            status: t.status,
                            assignee_id: t.assignee_id,
                            created_at: t.created_at,
                            subject: t.subject?.substring(0, 50) + "...",
                          })),
                        );

                        // Get status breakdown
                        const statusBreakdown = (tickets || []).reduce(
                          (acc, t) => {
                            acc[t.status] = (acc[t.status] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>,
                        );

                        const statusSummary = Object.entries(statusBreakdown)
                          .map(([status, count]) => `${status}: ${count}`)
                          .join("\n");

                        alert(
                          `✅ Real Ticket Status Summary:\n\n${statusSummary}\n\nTotal: ${tickets?.length || 0} tickets\n\nPeriod: ${selectedPeriod.label}`,
                        );
                      } catch (error) {
                        console.error("❌ Ticket status check failed:", error);
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        alert(
                          `❌ Failed to fetch ticket status: ${errorMessage}`,
                        );
                      }
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    Debug Ticket Status
                  </button>

                  <button
                    onClick={async () => {
                      console.log(
                        "��� Finding first and last closed tickets...",
                      );
                      try {
                        const { supabase } = await import("../lib/supabase");

                        const startDate = selectedPeriod.start
                          .toISOString()
                          .split("T")[0];
                        const endDate = selectedPeriod.end
                          .toISOString()
                          .split("T")[0];

                        console.log("📅 Period:", {
                          startDate,
                          endDate,
                          label: selectedPeriod.label,
                        });

                        // Get all closed tickets in the period
                        const { data: closedTickets, error } = await supabase
                          .from("tickets")
                          .select(
                            "zendesk_id, status, created_at, updated_at, subject",
                          )
                          .in("status", ["closed", "solved"])
                          .gte("created_at", startDate)
                          .lte("created_at", endDate)
                          .order("created_at", { ascending: true });

                        if (error) throw error;

                        console.log(
                          "🎯 Total closed tickets found:",
                          closedTickets?.length || 0,
                        );

                        if (!closedTickets || closedTickets.length === 0) {
                          alert("❌ No closed tickets found in this period");
                          return;
                        }

                        const firstTicket = closedTickets[0];
                        const lastTicket =
                          closedTickets[closedTickets.length - 1];

                        console.log("🏁 First closed ticket:", firstTicket);
                        console.log("🏁 Last closed ticket:", lastTicket);

                        const report =
                          `🔍 Closed Tickets Analysis (${selectedPeriod.label}):\n\n` +
                          `Total Closed Tickets: ${closedTickets.length}\n` +
                          `(Zendesk shows: 694)\n\n` +
                          `First Closed Ticket:\n` +
                          `• ID: ${firstTicket.zendesk_id}\n` +
                          `• Date: ${firstTicket.created_at}\n` +
                          `• Status: ${firstTicket.status}\n` +
                          `• Subject: ${firstTicket.subject?.substring(0, 50)}...\n\n` +
                          `Last Closed Ticket:\n` +
                          `• ID: ${lastTicket.zendesk_id}\n` +
                          `• Date: ${lastTicket.created_at}\n` +
                          `• Status: ${lastTicket.status}\n` +
                          `• Subject: ${lastTicket.subject?.substring(0, 50)}...\n\n` +
                          `📊 Discrepancy: ${694 - closedTickets.length} tickets missing\n` +
                          `Period: ${startDate} to ${endDate}`;

                        alert(report);
                      } catch (error) {
                        console.error(
                          "❌ Closed tickets analysis failed:",
                          error,
                        );
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        alert(
                          `❌ Failed to analyze closed tickets: ${errorMessage}`,
                        );
                      }
                    }}
                    className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                  >
                    Debug Closed Tickets
                  </button>

                  {/* Data Sync Gap Analysis */}
                  <button
                    onClick={async () => {
                      console.log("🔍 Analyzing data sync gaps for Akash...");
                      try {
                        const { supabase } = await import("../lib/supabase");
                        const { nameToIdMap } = await import(
                          "../lib/engineerMap.js"
                        );

                        const akashId = nameToIdMap.get("Akash Singh"); // Should be 26396676511767
                        console.log("👤 Akash Singh ID:", akashId);

                        // Get ALL tickets for Akash in our database
                        const { data: akashTickets, error } = await supabase
                          .from("tickets")
                          .select(
                            "zendesk_id, status, created_at, updated_at, subject",
                          )
                          .eq("assignee_id", akashId)
                          .order("zendesk_id", { ascending: true });

                        if (error) throw error;

                        console.log(
                          "📊 All Akash tickets in database:",
                          akashTickets,
                        );

                        // Get total ticket count in database
                        const { count: totalTickets } = await supabase
                          .from("tickets")
                          .select("*", { count: "exact", head: true });

                        // Get highest and lowest ticket IDs
                        const { data: idRange } = await supabase
                          .from("tickets")
                          .select("zendesk_id")
                          .order("zendesk_id", { ascending: false })
                          .limit(1);

                        const { data: idRangeMin } = await supabase
                          .from("tickets")
                          .select("zendesk_id")
                          .order("zendesk_id", { ascending: true })
                          .limit(1);

                        let report = "🔍 Data Sync Gap Analysis:\n\n";
                        report += `Total tickets in database: ${totalTickets || 0}\n`;
                        report += `Highest ticket ID: ${idRange?.[0]?.zendesk_id || "N/A"}\n`;
                        report += `Lowest ticket ID: ${idRangeMin?.[0]?.zendesk_id || "N/A"}\n\n`;

                        report += `Akash Singh (ID: ${akashId}):\n`;
                        report += `• Tickets in database: ${akashTickets?.length || 0}\n\n`;

                        if (akashTickets && akashTickets.length > 0) {
                          report += "📋 Akash's ticket IDs in database:\n";
                          const ticketIds = akashTickets
                            .map((t) => t.zendesk_id)
                            .sort((a, b) => parseInt(a) - parseInt(b));
                          report += ticketIds.join(", ") + "\n\n";

                          // Check if missing tickets are in expected range
                          const hasTicket19650 = ticketIds.includes("19650");
                          const hasTicket19339 = ticketIds.includes("19339");
                          report += `Missing tickets:\n`;
                          report += `• 19650: ${hasTicket19650 ? "✅ Found" : "❌ Missing"}\n`;
                          report += `• 19339: ${hasTicket19339 ? "✅ Found" : "❌ Missing"}\n\n`;
                        }

                        report += `�� ISSUE: Tickets 19650 and 19339 don't exist in database\n`;
                        report += `This indicates a data sync problem - not all Zendesk tickets are being imported.\n\n`;
                        report += `Recommendation: Run a full data sync from Zendesk to ensure all tickets are imported.`;

                        console.log("📋 Gap analysis report:", report);
                        alert(report);
                      } catch (error) {
                        console.error("❌ Gap analysis failed:", error);
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        alert(
                          `❌ Failed to analyze data gaps: ${errorMessage}`,
                        );
                      }
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    Debug Data Sync Gaps
                  </button>

                  {/* Daily Ticket Analysis */}
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedDebugDate}
                      onChange={(e) => setSelectedDebugDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select Date</option>
                      {(() => {
                        const dates = [];
                        const start = new Date(selectedPeriod.start);
                        const end = new Date(selectedPeriod.end);

                        for (
                          let d = new Date(start);
                          d <= end;
                          d.setDate(d.getDate() + 1)
                        ) {
                          const dateStr = d.toISOString().split("T")[0];
                          const displayDate = d.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          });
                          dates.push(
                            <option key={dateStr} value={dateStr}>
                              {displayDate}
                            </option>,
                          );
                        }
                        return dates;
                      })()}
                    </select>
                    <button
                      onClick={async () => {
                        if (!selectedDebugDate) {
                          alert("Please select a date first");
                          return;
                        }

                        console.log(
                          `📅 Analyzing tickets closed on ${selectedDebugDate}...`,
                        );
                        try {
                          const { supabase } = await import("../lib/supabase");
                          const { nameToIdMap } = await import(
                            "../lib/engineerMap.js"
                          );

                          // Create reverse mapping (ID to name)
                          const idToNameMap = new Map();
                          nameToIdMap.forEach((id, name) => {
                            idToNameMap.set(id, name);
                          });

                          // First, let's check what fields are available and debug the date filtering
                          console.log(
                            "🔍 Debugging date filtering for:",
                            selectedDebugDate,
                          );

                          // Get tickets closed on the specific date - try multiple approaches
                          const nextDay = new Date(
                            new Date(selectedDebugDate).getTime() +
                              24 * 60 * 60 * 1000,
                          )
                            .toISOString()
                            .split("T")[0];
                          console.log(
                            "📅 Date range:",
                            selectedDebugDate,
                            "to",
                            nextDay,
                          );

                          // Try to get all available fields first
                          const { data: sampleTickets, error: sampleError } =
                            await supabase
                              .from("tickets")
                              .select("*")
                              .in("status", ["closed", "solved"])
                              .limit(5);

                          if (sampleTickets && sampleTickets.length > 0) {
                            console.log(
                              "📊 Available ticket fields:",
                              Object.keys(sampleTickets[0]),
                            );
                            console.log(
                              "📋 Sample ticket data:",
                              sampleTickets[0],
                            );
                          }

                          // Try different date fields to find the right one
                          const queries = [
                            { field: "updated_at", name: "Updated At" },
                            { field: "solved_at", name: "Solved At" },
                            { field: "closed_at", name: "Closed At" },
                            { field: "created_at", name: "Created At" },
                          ];

                          let bestResults = null;
                          let bestField = "";

                          for (const query of queries) {
                            try {
                              const { data: testTickets, error: testError } =
                                await supabase
                                  .from("tickets")
                                  .select(
                                    "zendesk_id, status, created_at, updated_at, solved_at, closed_at, subject, assignee_id",
                                  )
                                  .in("status", ["closed", "solved"])
                                  .gte(query.field, selectedDebugDate)
                                  .lt(query.field, nextDay)
                                  .order(query.field, { ascending: true });

                              if (!testError && testTickets) {
                                console.log(
                                  `��� ${query.name} (${query.field}): ${testTickets.length} tickets`,
                                );
                                if (
                                  testTickets.length > 0 &&
                                  (!bestResults ||
                                    testTickets.length > bestResults.length)
                                ) {
                                  bestResults = testTickets;
                                  bestField = query.field;
                                }
                              }
                            } catch (e) {
                              console.log(
                                `❌ ${query.name} field not available`,
                              );
                            }
                          }

                          const dailyTickets = bestResults;

                          if (!bestResults || bestResults.length === 0) {
                            alert(
                              `❌ No closed tickets found on ${selectedDebugDate}\n\nThis could be because:\n• No tickets were closed on this date\n• The selected date is outside the data range\n• Data hasn't been synced from Zendesk\n\nTry selecting a different date or run: npm run sync:incremental`
                            );
                            return;
                          }

                          console.log(
                            `📊 Tickets found for ${selectedDebugDate} using field '${bestField}':`,
                            dailyTickets,
                          );

                          // Group by engineer name for better analysis
                          const byEngineer = dailyTickets.reduce(
                            (acc, ticket) => {
                              const engineerName =
                                idToNameMap.get(ticket.assignee_id) ||
                                `Unknown (ID: ${ticket.assignee_id || "Unassigned"})`;
                              if (!acc[engineerName]) acc[engineerName] = [];
                              acc[engineerName].push(ticket);
                              return acc;
                            },
                            {} as Record<string, any[]>,
                          );

                          let report = `📅 Daily Ticket Analysis - ${new Date(selectedDebugDate).toLocaleDateString("en-GB")}:\n\n`;
                          report += `Total Closed Tickets: ${dailyTickets.length}\n`;
                          report += `✅ Using date field: ${bestField}\n`;
                          report += `(Expected from Zendesk: 44 tickets)\n\n`;

                          report += `📋 Ticket List:\n`;
                          dailyTickets.forEach((ticket, i) => {
                            const engineerName =
                              idToNameMap.get(ticket.assignee_id) ||
                              `Unknown (${ticket.assignee_id})`;
                            report += `${i + 1}. ID: ${ticket.zendesk_id} | ${ticket.status} | ${ticket.created_at.split("T")[1].substring(0, 5)} | ${engineerName}\n`;
                          });

                          report += `\n👥 By Engineer:\n`;
                          Object.entries(byEngineer)
                            .sort(([, a], [, b]) => b.length - a.length) // Sort by ticket count descending
                            .forEach(([engineerName, tickets]) => {
                              report += `• ${engineerName}: ${tickets.length} tickets\n`;
                            });

                          console.log("Full daily report:", report);
                          alert(report);
                        } catch (error) {
                          console.error(
                            "❌ Daily ticket analysis failed:",
                            error,
                          );
                          const errorMessage =
                            error instanceof Error
                              ? error.message
                              : "Unknown error";
                          alert(
                            `❌ Failed to analyze daily tickets: ${errorMessage}`,
                          );
                        }
                      }}
                      disabled={!selectedDebugDate}
                      className={`px-3 py-1 text-xs rounded ${
                        selectedDebugDate
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Analyze Daily Tickets
                    </button>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="scorecard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger
              value="scorecard"
              className="flex items-center space-x-2"
            >
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
            <TabsTrigger
              value="summary"
              className="flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>Monthly Summary</span>
            </TabsTrigger>
          </TabsList>

          {/* Score Card Tab */}
          <TabsContent value="scorecard">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Team Average CES"
                value={
                  averageMetrics
                    ? `${averageMetrics.cesPercent.toFixed(1)}%`
                    : "-"
                }
                subtitle={selectedPeriod.label}
                trend={
                  averageMetrics && averageMetrics.cesPercent >= 80
                    ? "up"
                    : "down"
                }
                trendValue={
                  averageMetrics
                    ? `${averageMetrics.cesPercent >= 80 ? "+" : ""}${(averageMetrics.cesPercent - 80).toFixed(1)}%`
                    : undefined
                }
                color={
                  averageMetrics
                    ? averageMetrics.cesPercent >= 85
                      ? "green"
                      : averageMetrics.cesPercent >= 75
                        ? "yellow"
                        : "red"
                    : "blue"
                }
              />
              <MetricCard
                title="Total Tickets Closed"
                value={
                  engineerData.length > 0
                    ? (() => {
                        const total = engineerData.reduce((sum, eng) => sum + eng.closed, 0);
                        console.log('🎯 Closed tickets debug:', {
                          period: selectedPeriod.label,
                          total,
                          breakdown: engineerData.map(e => ({ name: e.name, closed: e.closed }))
                        });
                        return total;
                      })()
                    : "-"
                }
                subtitle={selectedPeriod.label}
                color="blue"
              />
              <MetricCard
                title="Avg Resolution Time"
                value={
                  averageMetrics
                    ? `${(averageMetrics.avgPcc / 24).toFixed(1)}d`
                    : "-"
                }
                subtitle="Days"
                color="purple"
              />
              <MetricCard
                title="Active Engineers"
                value={engineerData.length > 0 ? engineerData.length : "-"}
                subtitle="Currently tracked"
                color="yellow"
              />
            </div>

            {/* Performance Table */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Team Performance Overview
                </h2>
                <div className="text-sm text-gray-500 space-y-1">
                  <div>
                    Period: {selectedPeriod.label} (
                    {selectedPeriod.start.toLocaleDateString()} -{" "}
                    {selectedPeriod.end.toLocaleDateString()})
                  </div>
                  {lastUpdated && (
                    <div>
                      Last Updated: {lastUpdated.toLocaleDateString()} at{" "}
                      {lastUpdated.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
              {averageMetrics && engineerData.length > 0 ? (
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
                      Click "Pull Data" to sync data from Zendesk
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
                      {isLoading
                        ? "Loading engineers..."
                        : "No engineers found"}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Customer Effort Score"
                value={
                  currentEngineer
                    ? `${currentEngineer.cesPercent.toFixed(1)}%`
                    : "-"
                }
                subtitle="CES Score"
                trend={
                  currentEngineer &&
                  averageMetrics &&
                  currentEngineer.cesPercent > averageMetrics.cesPercent
                    ? "up"
                    : currentEngineer && averageMetrics
                      ? "down"
                      : undefined
                }
                trendValue={
                  currentEngineer && averageMetrics
                    ? `${currentEngineer.cesPercent > averageMetrics.cesPercent ? "+" : ""}${(currentEngineer.cesPercent - averageMetrics.cesPercent).toFixed(1)}%`
                    : undefined
                }
                color={
                  currentEngineer
                    ? currentEngineer.cesPercent >= 85
                      ? "green"
                      : currentEngineer.cesPercent >= 75
                        ? "yellow"
                        : "red"
                    : "blue"
                }
              />
              <MetricCard
                title="Tickets Closed"
                value={currentEngineer ? currentEngineer.closed : "-"}
                subtitle={selectedPeriod.label}
                trend={
                  currentEngineer &&
                  averageMetrics &&
                  currentEngineer.closed > averageMetrics.closed
                    ? "up"
                    : currentEngineer && averageMetrics
                      ? "down"
                      : undefined
                }
                trendValue={
                  currentEngineer && averageMetrics
                    ? `${currentEngineer.closed > averageMetrics.closed ? "+" : ""}${(currentEngineer.closed - averageMetrics.closed).toFixed(0)}`
                    : undefined
                }
                color="blue"
              />
              <MetricCard
                title="Overall Quality Score"
                value={
                  currentEngineer
                    ? currentEngineer.participationRate.toFixed(1)
                    : "-"
                }
                subtitle="Quality rating"
                trend={
                  currentEngineer &&
                  averageMetrics &&
                  currentEngineer.participationRate >
                    averageMetrics.participationRate
                    ? "up"
                    : currentEngineer && averageMetrics
                      ? "down"
                      : undefined
                }
                trendValue={
                  currentEngineer && averageMetrics
                    ? `${currentEngineer.participationRate > averageMetrics.participationRate ? "+" : ""}${(currentEngineer.participationRate - averageMetrics.participationRate).toFixed(1)}`
                    : undefined
                }
                color={
                  currentEngineer && averageMetrics
                    ? currentEngineer.participationRate >=
                      averageMetrics.participationRate
                      ? "green"
                      : "yellow"
                    : "blue"
                }
              />
              <MetricCard
                title="Technical Accuracy"
                value={
                  currentEngineer
                    ? currentEngineer.creationCount.toFixed(1)
                    : "-"
                }
                subtitle="Score out of 5"
                trend={
                  currentEngineer &&
                  averageMetrics &&
                  currentEngineer.creationCount > averageMetrics.creationCount
                    ? "up"
                    : currentEngineer && averageMetrics
                      ? "down"
                      : undefined
                }
                trendValue={
                  currentEngineer && averageMetrics
                    ? `${currentEngineer.creationCount > averageMetrics.creationCount ? "+" : ""}${(currentEngineer.creationCount - averageMetrics.creationCount).toFixed(1)}`
                    : undefined
                }
                color="purple"
              />
            </div>
          </TabsContent>

          {/* CES Deep Dive Tab - Engineer Comparison */}
          <TabsContent value="ces">
            <div className="space-y-6" key={`ces-${selectedComparisonEngineer}`}>
              {/* Engineer Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span>Engineer Performance Comparison</span>
                  </CardTitle>
                  <CardDescription>
                    Compare comprehensive metrics between engineers for{" "}
                    {selectedPeriod.label}
                    {!error && (
                      <span className="ml-2 text-green-600 text-xs">
                        • Live Data
                      </span>
                    )}
                    {error && error.includes('demo data') && (
                      <span className="ml-2 text-amber-600 text-xs">
                        • Demo Data
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4 mb-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Select Engineer to Analyze:
                      </label>
                      {engineerData.length > 0 ? (
                        <select
                          value={selectedComparisonEngineer}
                          onChange={(e) =>
                            setSelectedComparisonEngineer(e.target.value)
                          }
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
                        >
                          {engineerData.map((engineer) => (
                            <option key={engineer.name} value={engineer.name}>
                              {engineer.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500">
                          No engineers available
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comprehensive Comparison */}
              {(() => {
                console.log(`🔥 RENDER: selectedComparisonEngineer = "${selectedComparisonEngineer}"`);
                console.log(`🔥 RENDER: Available engineers:`, engineerData.map(e => e.name));

                const selectedEngineerData = engineerData.find(
                  (e) => e.name === selectedComparisonEngineer,
                );
                console.log(`🔥 RENDER: Using engineer data for:`, selectedEngineerData ? selectedEngineerData.name : 'NOT FOUND');
                if (!selectedEngineerData || !averageMetrics) {
                  return (
                    <Card>
                      <CardContent className="py-8">
                        <div className="text-center text-gray-500">
                          Select an engineer to see comprehensive comparison
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                const getComparisonColor = (
                  value: number,
                  average: number,
                  higherIsBetter = true,
                ) => {
                  const difference = higherIsBetter
                    ? value - average
                    : average - value;

                  // Debug CES color calculation specifically
                  if (selectedEngineerData.name === "Akash Singh" && average === averageMetrics.cesPercent) {
                    console.log(`🎯 CES COLOR DEBUG for ${selectedEngineerData.name}:`);
                    console.log(`   - Value: ${value}`);
                    console.log(`   - Average: ${average}`);
                    console.log(`   - Higher is better: ${higherIsBetter}`);
                    console.log(`   - Difference: ${difference}`);
                    console.log(`   - Threshold (average * 0.1): ${average * 0.1}`);
                    console.log(`   - Condition checks:`);
                    console.log(`     - difference > ${average * 0.1}: ${difference > average * 0.1} (green)`);
                    console.log(`     - difference < ${-average * 0.1}: ${difference < -average * 0.1} (red)`);
                  }

                  let colorClass;
                  if (difference > average * 0.1) {
                    colorClass = "text-green-600 bg-green-50";
                  } else if (difference < -average * 0.1) {
                    colorClass = "text-red-600 bg-red-50";
                  } else {
                    colorClass = "text-yellow-600 bg-yellow-50";
                  }

                  // Debug color return for CES
                  if (selectedEngineerData.name === "Akash Singh" && average === averageMetrics.cesPercent) {
                    console.log(`��� CES COLOR RESULT: ${colorClass}`);
                  }

                  return colorClass;
                };

                const getComparisonIndicator = (
                  value: number,
                  average: number,
                  higherIsBetter = true,
                ) => {
                  const difference = higherIsBetter
                    ? value - average
                    : average - value;
                  if (difference > average * 0.1) return "↗️ Above Average";
                  if (difference < -average * 0.1) return "↘️ Below Average";
                  return "➡️ Near Average";
                };

                const getRankPosition = (
                  value: number,
                  metric: keyof typeof selectedEngineerData,
                  higherIsBetter = true,
                ) => {
                  const sorted = [...engineerData].sort((a, b) =>
                    higherIsBetter
                      ? (b[metric] as number) - (a[metric] as number)
                      : (a[metric] as number) - (b[metric] as number),
                  );
                  const position =
                    sorted.findIndex(
                      (e) => e.name === selectedEngineerData.name,
                    ) + 1;
                  return `${position}/${engineerData.length}`;
                };

                const getRankNumber = (
                  value: number,
                  metric: keyof typeof selectedEngineerData,
                  higherIsBetter = true,
                ) => {
                  const sorted = [...engineerData].sort((a, b) =>
                    higherIsBetter
                      ? (b[metric] as number) - (a[metric] as number)
                      : (a[metric] as number) - (b[metric] as number),
                  );
                  return sorted.findIndex(
                    (e) => e.name === selectedEngineerData.name,
                  ) + 1;
                };

                const calculateAverageRanking = () => {
                  const ranks = [
                    // Core Performance Metrics
                    getRankNumber(selectedEngineerData.cesPercent, "cesPercent", true),
                    getRankNumber(selectedEngineerData.closed, "closed", true),
                    getRankNumber(selectedEngineerData.surveyCount, "surveyCount", true),
                    getRankNumber(selectedEngineerData.avgPcc, "avgPcc", false), // lower is better
                    getRankNumber(selectedEngineerData.participationRate, "participationRate", true),
                    getRankNumber(selectedEngineerData.enterprisePercent, "enterprisePercent", true),

                    // Resolution Efficiency Metrics
                    getRankNumber(selectedEngineerData.closedEqual1, "closedEqual1", true), // % closed within 1 day
                    getRankNumber(selectedEngineerData.closedLessThan7, "closedLessThan7", true), // % closed within 7 days

                    // Quality & Communication Metrics
                    getRankNumber(selectedEngineerData.linkCount, "linkCount", true), // communication score
                    getRankNumber(selectedEngineerData.citationCount, "citationCount", true), // citations provided
                    getRankNumber(selectedEngineerData.creationCount, "creationCount", true), // content creation
                  ];
                  const averageRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
                  return {
                    averageRank: averageRank.toFixed(1),
                    totalEngineers: engineerData.length,
                    individualRanks: ranks,
                    categoryRanks: {
                      core: ranks.slice(0, 6),
                      resolutionEfficiency: ranks.slice(6, 8),
                      qualityCommunication: ranks.slice(8, 11)
                    }
                  };
                };

                return (
                  <div className="space-y-6">
                    {/* Performance Overview */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {selectedEngineerData.name} - Performance Overview
                        </CardTitle>
                        <CardDescription>
                          Comprehensive metrics comparison vs team average and
                          ranking
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {/* Average Ranking Card */}
                        {(() => {
                          const avgRanking = calculateAverageRanking();
                          const rankPercentile = ((engineerData.length - parseFloat(avgRanking.averageRank) + 1) / engineerData.length) * 100;

                          const getRankingColor = () => {
                            if (rankPercentile >= 75) return "text-green-600 bg-green-50 border-green-200";
                            if (rankPercentile >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
                            return "text-red-600 bg-red-50 border-red-200";
                          };

                          const getRankingLabel = () => {
                            if (rankPercentile >= 75) return "🏆 Top Performer";
                            if (rankPercentile >= 50) return "📊 Average Performer";
                            return "📈 Needs Improvement";
                          };

                          return (
                            <div className={`p-6 rounded-lg border-2 mb-6 ${getRankingColor()}`}>
                              <div className="text-center">
                                <h3 className="text-lg font-bold mb-2">Overall Performance Ranking</h3>
                                <div className="text-3xl font-bold mb-2">
                                  #{avgRanking.averageRank} / {avgRanking.totalEngineers}
                                </div>
                                <div className="text-sm font-medium mb-2">
                                  {getRankingLabel()} ({rankPercentile.toFixed(0)}th percentile)
                                </div>
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div>
                                    <strong>Core Performance:</strong> CES ({avgRanking.individualRanks[0]}),
                                    Closed ({avgRanking.individualRanks[1]}),
                                    Surveys ({avgRanking.individualRanks[2]}),
                                    Response Time ({avgRanking.individualRanks[3]}),
                                    Quality ({avgRanking.individualRanks[4]}),
                                    Enterprise ({avgRanking.individualRanks[5]})
                                  </div>
                                  <div>
                                    <strong>Resolution Efficiency:</strong> 1-Day Close ({avgRanking.individualRanks[6]}),
                                    7-Day Close ({avgRanking.individualRanks[7]})
                                  </div>
                                  <div>
                                    <strong>Quality & Communication:</strong> Links ({avgRanking.individualRanks[8]}),
                                    Citations ({avgRanking.individualRanks[9]}),
                                    Content Creation ({avgRanking.individualRanks[10]})
                                  </div>
                                  <div className="mt-2 pt-1 border-t border-gray-300">
                                    <em>Average across all 11 comprehensive metrics</em>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* CES Performance */}
                          <div
                            className={`p-4 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow ${getComparisonColor(selectedEngineerData.cesPercent, averageMetrics.cesPercent)}`}
                            onClick={() =>
                              handleCardClick("ces", selectedEngineerData.name)
                            }
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-sm">
                                CES Score 🔍
                              </h4>
                              <span className="text-xs font-medium">
                                Rank:{" "}
                                {getRankPosition(
                                  selectedEngineerData.cesPercent,
                                  "cesPercent",
                                  true,
                                )}
                              </span>
                            </div>
                            <div className="text-xl font-bold">
                              {selectedEngineerData.cesPercent.toFixed(1)}%
                            </div>
                            <div className="text-sm">
                              vs {averageMetrics.cesPercent.toFixed(1)}% avg
                            </div>
                            <div className="text-xs mt-1">
                              {getComparisonIndicator(
                                selectedEngineerData.cesPercent,
                                averageMetrics.cesPercent,
                              )}
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                              Click for details
                            </div>
                          </div>

                          {/* Tickets Closed */}
                          <div
                            className={`p-4 rounded-lg border-l-4 border-green-500 ${getComparisonColor(selectedEngineerData.closed, averageMetrics.closed)}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-sm">
                                Tickets Closed
                              </h4>
                              <span className="text-xs font-medium">
                                Rank:{" "}
                                {getRankPosition(
                                  selectedEngineerData.closed,
                                  "closed",
                                  true,
                                )}
                              </span>
                            </div>
                            <div className="text-xl font-bold">
                              {selectedEngineerData.closed}
                            </div>
                            <div className="text-sm">
                              vs {averageMetrics.closed.toFixed(1)} avg
                            </div>
                            <div className="text-xs mt-1">
                              {getComparisonIndicator(
                                selectedEngineerData.closed,
                                averageMetrics.closed,
                              )}
                            </div>
                          </div>

                          {/* Survey Count */}
                          <div
                            className={`p-4 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition-shadow ${getComparisonColor(selectedEngineerData.surveyCount, averageMetrics.surveyCount)}`}
                            onClick={() =>
                              handleCardClick(
                                "survey",
                                selectedEngineerData.name,
                              )
                            }
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-sm">
                                Survey Responses 🔍
                              </h4>
                              <span className="text-xs font-medium">
                                Rank:{" "}
                                {getRankPosition(
                                  selectedEngineerData.surveyCount,
                                  "surveyCount",
                                  true,
                                )}
                              </span>
                            </div>
                            <div className="text-xl font-bold">
                              {selectedEngineerData.surveyCount}
                            </div>
                            <div className="text-sm">
                              vs {averageMetrics.surveyCount.toFixed(1)} avg
                            </div>
                            <div className="text-xs mt-1">
                              {getComparisonIndicator(
                                selectedEngineerData.surveyCount,
                                averageMetrics.surveyCount,
                              )}
                            </div>
                            <div className="text-xs text-purple-600 mt-1">
                              Click for ticket IDs
                            </div>
                          </div>

                          {/* Response Time */}
                          <div
                            className={`p-4 rounded-lg border-l-4 border-orange-500 ${getComparisonColor(selectedEngineerData.avgPcc, averageMetrics.avgPcc, false)}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-sm">
                                Avg Response Time
                              </h4>
                              <span className="text-xs font-medium">
                                Rank:{" "}
                                {getRankPosition(
                                  selectedEngineerData.avgPcc,
                                  "avgPcc",
                                  false,
                                )}
                              </span>
                            </div>
                            <div className="text-xl font-bold">
                              {selectedEngineerData.avgPcc.toFixed(1)}h
                            </div>
                            <div className="text-sm">
                              vs {averageMetrics.avgPcc.toFixed(1)}h avg
                            </div>
                            <div className="text-xs mt-1">
                              {getComparisonIndicator(
                                selectedEngineerData.avgPcc,
                                averageMetrics.avgPcc,
                                false,
                              )}
                            </div>
                          </div>

                          {/* Quality Score */}
                          <div
                            className={`p-4 rounded-lg border-l-4 border-indigo-500 ${getComparisonColor(selectedEngineerData.participationRate, averageMetrics.participationRate)}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-sm">
                                Quality Score
                              </h4>
                              <span className="text-xs font-medium">
                                Rank:{" "}
                                {getRankPosition(
                                  selectedEngineerData.participationRate,
                                  "participationRate",
                                  true,
                                )}
                              </span>
                            </div>
                            <div className="text-xl font-bold">
                              {selectedEngineerData.participationRate.toFixed(
                                1,
                              )}
                            </div>
                            <div className="text-sm">
                              vs {averageMetrics.participationRate.toFixed(1)}{" "}
                              avg
                            </div>
                            <div className="text-xs mt-1">
                              {getComparisonIndicator(
                                selectedEngineerData.participationRate,
                                averageMetrics.participationRate,
                              )}
                            </div>
                          </div>

                          {/* Enterprise Percentage */}
                          <div
                            className={`p-4 rounded-lg border-l-4 border-red-500 cursor-pointer hover:shadow-lg transition-shadow ${getComparisonColor(selectedEngineerData.enterprisePercent, averageMetrics.enterprisePercent)}`}
                            onClick={() =>
                              handleCardClick(
                                "enterprise",
                                selectedEngineerData.name,
                              )
                            }
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-sm">
                                Enterprise % 🔍
                              </h4>
                              <span className="text-xs font-medium">
                                Rank:{" "}
                                {getRankPosition(
                                  selectedEngineerData.enterprisePercent,
                                  "enterprisePercent",
                                  true,
                                )}
                              </span>
                            </div>
                            <div className="text-xl font-bold">
                              {selectedEngineerData.enterprisePercent.toFixed(
                                1,
                              )}
                              %
                            </div>
                            <div className="text-sm">
                              vs {averageMetrics.enterprisePercent.toFixed(1)}%
                              avg
                            </div>
                            <div className="text-xs mt-1">
                              {getComparisonIndicator(
                                selectedEngineerData.enterprisePercent,
                                averageMetrics.enterprisePercent,
                              )}
                            </div>
                            <div className="text-xs text-red-600 mt-1">
                              Click for enterprise tickets
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Detailed Metrics Comparison */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Resolution Efficiency */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            Resolution Efficiency
                          </CardTitle>
                          <CardDescription>
                            Time-based performance metrics
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Closed ≤ 3 Days
                              </span>
                              <div className="text-right">
                                <div className="font-bold">
                                  {selectedEngineerData.closedEqual1.toFixed(1)}
                                  %
                                </div>
                                <div className="text-xs text-gray-500">
                                  vs {averageMetrics.closedEqual1.toFixed(1)}%
                                  avg
                                </div>
                              </div>
                            </div>
                            <Progress
                              value={selectedEngineerData.closedEqual1}
                              className="h-2"
                            />

                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Closed ≤ 14 Days
                              </span>
                              <div className="text-right">
                                <div className="font-bold">
                                  {selectedEngineerData.closedLessThan7.toFixed(
                                    1,
                                  )}
                                  %
                                </div>
                                <div className="text-xs text-gray-500">
                                  vs {averageMetrics.closedLessThan7.toFixed(1)}
                                  % avg
                                </div>
                              </div>
                            </div>
                            <Progress
                              value={selectedEngineerData.closedLessThan7}
                              className="h-2"
                            />

                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Open &gt; 14 Days
                              </span>
                              <div className="text-right">
                                <div className="font-bold">
                                  {selectedEngineerData.openGreaterThan14}
                                </div>
                                <div className="text-xs text-gray-500">
                                  vs{" "}
                                  {averageMetrics.openGreaterThan14.toFixed(1)}{" "}
                                  avg
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Quality & Communication */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            Quality & Communication
                          </CardTitle>
                          <CardDescription>
                            Interaction and technical metrics
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Technical Accuracy
                              </span>
                              <div className="text-right">
                                <div className="font-bold">
                                  {selectedEngineerData.creationCount.toFixed(
                                    1,
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  vs {averageMetrics.creationCount.toFixed(1)}{" "}
                                  avg
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Response Quality
                              </span>
                              <div className="text-right">
                                <div className="font-bold">
                                  {selectedEngineerData.citationCount.toFixed(
                                    1,
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  vs {averageMetrics.citationCount.toFixed(1)}{" "}
                                  avg
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Communication Score
                              </span>
                              <div className="text-right">
                                <div className="font-bold">
                                  {selectedEngineerData.linkCount.toFixed(1)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  vs {averageMetrics.linkCount.toFixed(1)} avg
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Technical Requests %
                              </span>
                              <div className="text-right">
                                <div className="font-bold">
                                  {selectedEngineerData.technicalPercent.toFixed(
                                    1,
                                  )}
                                  %
                                </div>
                                <div className="text-xs text-gray-500">
                                  vs{" "}
                                  {averageMetrics.technicalPercent.toFixed(1)}%
                                  avg
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Team Ranking */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Team Performance Ranking
                        </CardTitle>
                        <CardDescription>
                          How {selectedEngineerData.name} ranks against other
                          team members
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2">Engineer</th>
                                <th className="text-center py-2">CES %</th>
                                <th className="text-center py-2">Closed</th>
                                <th className="text-center py-2">
                                  Enterprise %
                                </th>
                                <th className="text-center py-2">Quality</th>
                                <th className="text-center py-2">
                                  Response Time
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {engineerData
                                .sort((a, b) => b.cesPercent - a.cesPercent)
                                .map((engineer, index) => (
                                  <tr
                                    key={engineer.name}
                                    className={`border-b ${engineer.name === selectedEngineerData.name ? "bg-blue-50 font-medium" : ""}`}
                                  >
                                    <td className="py-2">
                                      {index + 1}. {engineer.name}
                                      {engineer.name ===
                                        selectedEngineerData.name && (
                                        <span className="ml-2 text-blue-600">
                                          ← Selected
                                        </span>
                                      )}
                                    </td>
                                    <td className="text-center py-2">
                                      {engineer.cesPercent.toFixed(1)}%
                                    </td>
                                    <td className="text-center py-2">
                                      {engineer.closed}
                                    </td>
                                    <td className="text-center py-2">
                                      {engineer.enterprisePercent.toFixed(1)}%
                                    </td>
                                    <td className="text-center py-2">
                                      {engineer.participationRate.toFixed(1)}
                                    </td>
                                    <td className="text-center py-2">
                                      {engineer.avgPcc.toFixed(1)}h
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
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
                  <CardDescription>
                    Comprehensive quality assessment across all engineers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-xl font-bold text-purple-600">
                        {averageMetrics
                          ? averageMetrics.participationRate.toFixed(1)
                          : "--"}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg Quality Score
                      </div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-xl font-bold text-blue-600">
                        {averageMetrics
                          ? averageMetrics.citationCount.toFixed(1)
                          : "--"}
                      </div>
                      <div className="text-sm text-gray-600">
                        Response Quality
                      </div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-xl font-bold text-green-600">
                        {averageMetrics
                          ? averageMetrics.creationCount.toFixed(1)
                          : "--"}
                      </div>
                      <div className="text-sm text-gray-600">
                        Technical Accuracy
                      </div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-xl font-bold text-orange-600">
                        {averageMetrics
                          ? averageMetrics.linkCount.toFixed(1)
                          : "--"}
                      </div>
                      <div className="text-sm text-gray-600">Communication</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monthly Summary Tab */}
          <TabsContent value="summary">
            <div className="space-y-6">
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Monthly Performance Summary
                </h2>
                <p className="text-gray-600">
                  {selectedPeriod.label} • Generated on{" "}
                  {new Date().toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Nested Tabs for Team vs Individual Summary */}
              <Tabs
                value={summaryTab}
                onValueChange={setSummaryTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="team">Team Summary</TabsTrigger>
                  <TabsTrigger value="individual">
                    Individual Summary
                  </TabsTrigger>
                </TabsList>

                {/* Team Summary Tab */}
                <TabsContent value="team" className="space-y-6 mt-6">
                  {/* Main Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="text-center p-8 bg-green-50 rounded-xl border border-green-200">
                      <div className="text-4xl font-bold text-green-600 mb-3">
                        {engineerData.length > 0
                          ? engineerData.reduce(
                              (sum, eng) => sum + eng.closed,
                              0,
                            )
                          : "0"}
                      </div>
                      <div className="text-lg font-medium text-gray-700">
                        Total Tickets Resolved
                      </div>
                    </div>
                    <div className="text-center p-8 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="text-4xl font-bold text-blue-600 mb-3">
                        {averageMetrics
                          ? averageMetrics.cesPercent.toFixed(1)
                          : "0.0"}
                        %
                      </div>
                      <div className="text-lg font-medium text-gray-700">
                        Average CES Score
                      </div>
                    </div>
                    <div className="text-center p-8 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="text-4xl font-bold text-purple-600 mb-3">
                        {averageMetrics
                          ? (averageMetrics.avgPcc / 24).toFixed(1)
                          : "0.0"}
                        d
                      </div>
                      <div className="text-lg font-medium text-gray-700">
                        Avg Response Time
                      </div>
                    </div>
                  </div>

                  {/* Key Achievements and Recommendations */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Key Achievements */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">
                          Key Achievements
                        </h3>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={copyKeyAchievements}
                            className="flex items-center justify-center p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            title="Copy achievements to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={exportRecommendationsToPDF}
                            className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Export to PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            disabled
                            className="flex items-center justify-center p-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                            title="15Five integration - Coming soon"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-gray-900">
                              Excellent Team Performance
                            </div>
                            <div className="text-sm text-gray-600">
                              {
                                engineerData.filter((e) => e.cesPercent >= 85)
                                  .length
                              }{" "}
                              engineers achieved CES scores above 85%
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-gray-900">
                              High Resolution Rate
                            </div>
                            <div className="text-sm text-gray-600">
                              Successfully resolved{" "}
                              {engineerData.length > 0
                                ? engineerData.reduce(
                                    (sum, eng) => sum + eng.closed,
                                    0,
                                  )
                                : 0}{" "}
                              tickets this period
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-gray-900">
                              Quality Consistency
                            </div>
                            <div className="text-sm text-gray-600">
                              Maintained high quality standards across all
                              support channels
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">
                          Recommendations for Next Month
                        </h3>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={copyRecommendations}
                            className="flex items-center justify-center p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            title="Copy recommendations to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={exportRecommendationsToPDF}
                            className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Export to PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            disabled
                            className="flex items-center justify-center p-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                            title="15Five integration - Coming soon"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {(() => {
                          const recommendations = [];

                          if (!engineerData.length || !averageMetrics) {
                            return <div className="text-gray-500">No data available for recommendations</div>;
                          }

                          // 1. CES Analysis & Training Needs
                          const lowCESEngineers = engineerData.filter(e => e.cesPercent < 70);
                          const highCESEngineers = engineerData.filter(e => e.cesPercent >= 85);
                          const avgCES = averageMetrics.cesPercent;

                          if (lowCESEngineers.length > 0) {
                            recommendations.push({
                              title: "Customer Satisfaction Training",
                              message: `${lowCESEngineers.length} engineer(s) with CES below 70%: ${lowCESEngineers.map(e => e.name).join(", ")}. Implement targeted communication training and pair with high-performing mentors.`,
                              color: "red",
                              priority: "high"
                            });
                          } else if (avgCES < 75) {
                            recommendations.push({
                              title: "Team-wide CES Enhancement",
                              message: `Team average CES of ${avgCES.toFixed(1)}% needs improvement. Consider customer empathy workshops and solution clarity training for all engineers.`,
                              color: "yellow",
                              priority: "medium"
                            });
                          }

                          // 2. Response Time Optimization
                          const slowResponseEngineers = engineerData.filter(e => e.avgPcc > averageMetrics.avgPcc * 1.3);
                          const avgResponseDays = (averageMetrics.avgPcc / 24).toFixed(1);

                          if (slowResponseEngineers.length > 0) {
                            recommendations.push({
                              title: "Response Time Optimization",
                              message: `${slowResponseEngineers.length} engineer(s) have response times >30% above average (${avgResponseDays}d): ${slowResponseEngineers.map(e => e.name).join(", ")}. Deploy knowledge base improvements and response templates.`,
                              color: "orange",
                              priority: "medium"
                            });
                          } else if (averageMetrics.avgPcc > 72) { // >3 days average
                            recommendations.push({
                              title: "Team Response Time Initiative",
                              message: `Team average response time of ${avgResponseDays} days exceeds target. Implement automated routing and expand knowledge base coverage.`,
                              color: "blue",
                              priority: "medium"
                            });
                          }

                          // 3. Workload Distribution Analysis
                          const totalTickets = engineerData.reduce((sum, e) => sum + e.closed, 0);
                          const ticketDistribution = engineerData.map(e => e.closed);
                          const maxTickets = Math.max(...ticketDistribution);
                          const minTickets = Math.min(...ticketDistribution);
                          const workloadImbalance = (maxTickets - minTickets) / averageMetrics.closed;

                          if (workloadImbalance > 0.5) {
                            const highVolumeEngineers = engineerData.filter(e => e.closed > averageMetrics.closed * 1.3);
                            const lowVolumeEngineers = engineerData.filter(e => e.closed < averageMetrics.closed * 0.7);

                            recommendations.push({
                              title: "Workload Rebalancing Needed",
                              message: `Significant workload imbalance detected. High volume: ${highVolumeEngineers.map(e => `${e.name} (${e.closed})`).join(", ")}. Low volume: ${lowVolumeEngineers.map(e => `${e.name} (${e.closed})`).join(", ")}. Review ticket routing logic.`,
                              color: "purple",
                              priority: "high"
                            });
                          }

                          // 4. Quality vs Quantity Analysis
                          const highVolumeHighQuality = engineerData.filter(e => e.closed > averageMetrics.closed && e.cesPercent > avgCES);
                          const lowVolumeHighQuality = engineerData.filter(e => e.closed < averageMetrics.closed * 0.8 && e.cesPercent > avgCES + 10);

                          if (highVolumeHighQuality.length > 0) {
                            recommendations.push({
                              title: "Excellence Recognition & Mentoring",
                              message: `Top performers with high volume AND quality: ${highVolumeHighQuality.map(e => e.name).join(", ")}. Consider for mentoring roles and advanced responsibilities.`,
                              color: "green",
                              priority: "low"
                            });
                          }

                          if (lowVolumeHighQuality.length > 0) {
                            recommendations.push({
                              title: "Capacity Expansion Opportunity",
                              message: `High-quality low-volume engineers: ${lowVolumeHighQuality.map(e => e.name).join(", ")}. Could handle increased workload while maintaining standards.`,
                              color: "blue",
                              priority: "medium"
                            });
                          }

                          // 5. Resolution Efficiency Analysis
                          const avgQuickResolution = engineerData.reduce((sum, e) => sum + e.closedEqual1, 0) / engineerData.length;
                          const inefficientEngineers = engineerData.filter(e => e.closedEqual1 < avgQuickResolution * 0.7);

                          if (avgQuickResolution < 40) {
                            recommendations.push({
                              title: "Quick Resolution Training Program",
                              message: `Team average 1-day resolution rate of ${avgQuickResolution.toFixed(1)}% is below target. Implement triage training and expand self-service options.`,
                              color: "orange",
                              priority: "medium"
                            });
                          }

                          // 6. Survey Participation & Feedback
                          const avgSurveyCount = averageMetrics.surveyCount;
                          const lowSurveyEngineers = engineerData.filter(e => e.surveyCount < avgSurveyCount * 0.6);

                          if (lowSurveyEngineers.length > 0) {
                            recommendations.push({
                              title: "Customer Feedback Engagement",
                              message: `Low survey participation from ${lowSurveyEngineers.length} engineer(s): ${lowSurveyEngineers.map(e => e.name).join(", ")}. Implement follow-up automation to increase feedback collection.`,
                              color: "indigo",
                              priority: "low"
                            });
                          }

                          // 7. Technical vs Enterprise Balance
                          const avgTechnical = averageMetrics.technicalPercent;
                          const avgEnterprise = averageMetrics.enterprisePercent;

                          if (avgEnterprise < 15) {
                            recommendations.push({
                              title: "Enterprise Customer Focus",
                              message: `Enterprise ticket percentage (${avgEnterprise.toFixed(1)}%) is low. Consider dedicated enterprise support training and routing improvements.`,
                              color: "purple",
                              priority: "medium"
                            });
                          }

                          // Sort by priority and limit to top 4 recommendations
                          const priorityOrder = { high: 3, medium: 2, low: 1 };
                          const topRecommendations = recommendations
                            .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
                            .slice(0, 4);

                          const colorClasses = {
                            red: "bg-red-50 border-red-500 text-red-900 text-red-800",
                            yellow: "bg-yellow-50 border-yellow-500 text-yellow-900 text-yellow-800",
                            green: "bg-green-50 border-green-500 text-green-900 text-green-800",
                            blue: "bg-blue-50 border-blue-500 text-blue-900 text-blue-800",
                            purple: "bg-purple-50 border-purple-500 text-purple-900 text-purple-800",
                            orange: "bg-orange-50 border-orange-500 text-orange-900 text-orange-800",
                            indigo: "bg-indigo-50 border-indigo-500 text-indigo-900 text-indigo-800"
                          };

                          return topRecommendations.map((rec, index) => (
                            <div key={index} className={`p-4 rounded-lg border-l-4 ${colorClasses[rec.color].split(' ').slice(0, 2).join(' ')}`}>
                              <div className={`font-semibold mb-1 ${colorClasses[rec.color].split(' ')[2]} flex items-center justify-between`}>
                                {rec.title}
                                <span className={`text-xs px-2 py-1 rounded ${rec.priority === 'high' ? 'bg-red-200 text-red-800' : rec.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-700'}`}>
                                  {rec.priority.toUpperCase()}
                                </span>
                              </div>
                              <div className={`text-sm ${colorClasses[rec.color].split(' ')[3]}`}>
                                {rec.message}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Analytics */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6">
                      Detailed Analytics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          Total Surveys
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {averageMetrics
                            ? engineerData.reduce(
                                (sum, eng) => sum + eng.surveyCount,
                                0,
                              )
                            : "0"}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          Avg Technical %
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {averageMetrics
                            ? averageMetrics.technicalPercent.toFixed(1)
                            : "0.0"}
                          %
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          Enterprise %
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {averageMetrics
                            ? averageMetrics.enterprisePercent.toFixed(1)
                            : "0.0"}
                          %
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          Open Tickets
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {engineerData.length > 0
                            ? engineerData.reduce(
                                (sum, eng) => sum + eng.open,
                                0,
                              )
                            : "0"}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Individual Summary Tab */}
                <TabsContent value="individual" className="space-y-6 mt-6">
                  {/* Engineer Selection */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">
                      Individual Performance Summary
                    </h3>
                    <div className="w-64">
                      <select
                        value={selectedIndividualEngineer}
                        onChange={(e) =>
                          setSelectedIndividualEngineer(e.target.value)
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {engineerData.map((engineer) => (
                          <option key={engineer.name} value={engineer.name}>
                            {engineer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const selectedEngineerData = engineerData.find(
                      (e) => e.name === selectedIndividualEngineer,
                    );
                    if (!selectedEngineerData)
                      return <div>No engineer selected</div>;

                    return (
                      <>
                        {/* Individual Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                          <div className="text-center p-8 bg-green-50 rounded-xl border border-green-200">
                            <div className="text-4xl font-bold text-green-600 mb-3">
                              {selectedEngineerData.closed}
                            </div>
                            <div className="text-lg font-medium text-gray-700">
                              Tickets Resolved
                            </div>
                          </div>
                          <div className="text-center p-8 bg-blue-50 rounded-xl border border-blue-200">
                            <div className="text-4xl font-bold text-blue-600 mb-3">
                              {selectedEngineerData.cesPercent.toFixed(1)}%
                            </div>
                            <div className="text-lg font-medium text-gray-700">
                              CES Score
                            </div>
                          </div>
                          <div className="text-center p-8 bg-purple-50 rounded-xl border border-purple-200">
                            <div className="text-4xl font-bold text-purple-600 mb-3">
                              {(selectedEngineerData.avgPcc / 24).toFixed(1)}d
                            </div>
                            <div className="text-lg font-medium text-gray-700">
                              Avg Response Time
                            </div>
                          </div>
                        </div>

                        {/* Individual Achievements and Recommendations */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                          {/* Individual Achievements */}
                          <div>
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="text-lg font-bold text-gray-900">
                                Key Achievements
                              </h3>
                              <div className="flex items-center space-x-2">
                          <button
                            onClick={copyKeyAchievements}
                            className="flex items-center justify-center p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            title="Copy achievements to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={exportRecommendationsToPDF}
                            className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Export to PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            disabled
                            className="flex items-center justify-center p-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                            title="15Five integration - Coming soon"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        </div>
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-start space-x-3">
                                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {selectedEngineerData.cesPercent >= 90
                                      ? "Outstanding Customer Satisfaction"
                                      : selectedEngineerData.cesPercent >= 75
                                        ? "Good Customer Satisfaction"
                                        : "Improving Customer Satisfaction"}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Achieved{" "}
                                    {selectedEngineerData.cesPercent.toFixed(1)}
                                    % CES score based on{" "}
                                    {selectedEngineerData.surveyCount} customer
                                    surveys
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-start space-x-3">
                                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {selectedEngineerData.closed >=
                                    (averageMetrics?.closed || 0)
                                      ? "Above Average Resolution Rate"
                                      : "Consistent Resolution Rate"}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Successfully resolved{" "}
                                    {selectedEngineerData.closed} tickets this
                                    period
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-start space-x-3">
                                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {selectedEngineerData.avgPcc <=
                                    (averageMetrics?.avgPcc || 200)
                                      ? "Fast Response Time"
                                      : "Improving Response Time"}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Maintained{" "}
                                    {selectedEngineerData.avgPcc.toFixed(1)}h
                                    average response time
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Individual Recommendations */}
                          <div>
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="text-lg font-bold text-gray-900">
                                Recommendations
                              </h3>
                              <div className="flex items-center space-x-2">
                          <button
                            onClick={copyRecommendations}
                            className="flex items-center justify-center p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            title="Copy recommendations to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={exportRecommendationsToPDF}
                            className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Export to PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            disabled
                            className="flex items-center justify-center p-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                            title="15Five integration - Coming soon"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        </div>
                            </div>
                            <div className="space-y-4">
                              {(() => {
                                const recommendations = [];
                                const avgCES = averageMetrics?.cesPercent || 75;
                                const avgClosed = averageMetrics?.closed || 50;
                                const avgResponseTime = averageMetrics?.avgPcc || 150;
                                const avgSurveyCount = averageMetrics?.surveyCount || 5;
                                const avgParticipation = averageMetrics?.participationRate || 3.5;
                                const avgTechnical = averageMetrics?.technicalPercent || 60;
                                const avgEnterprise = averageMetrics?.enterprisePercent || 20;

                                // 1. CES Performance Analysis
                                if (selectedEngineerData.cesPercent < 40) {
                                  recommendations.push({
                                    title: "🚨 Urgent CES Intervention",
                                    message: `CES score of ${selectedEngineerData.cesPercent.toFixed(1)}% requires immediate action. Schedule daily coaching sessions, implement communication script templates, and pair with top performer for shadowing.`,
                                    color: "red",
                                    priority: "critical"
                                  });
                                } else if (selectedEngineerData.cesPercent < 60) {
                                  recommendations.push({
                                    title: "📈 CES Recovery Plan",
                                    message: `CES score of ${selectedEngineerData.cesPercent.toFixed(1)}% needs structured improvement. Recommend customer empathy training, solution explanation workshops, and weekly progress reviews.`,
                                    color: "red",
                                    priority: "high"
                                  });
                                } else if (selectedEngineerData.cesPercent < avgCES) {
                                  recommendations.push({
                                    title: "🎯 CES Enhancement Focus",
                                    message: `CES score of ${selectedEngineerData.cesPercent.toFixed(1)}% is ${(avgCES - selectedEngineerData.cesPercent).toFixed(1)} points below average. Focus on active listening techniques and clear solution communication.`,
                                    color: "yellow",
                                    priority: "medium"
                                  });
                                } else if (selectedEngineerData.cesPercent > avgCES + 15) {
                                  recommendations.push({
                                    title: "🌟 CES Excellence - Leadership Role",
                                    message: `Outstanding CES score of ${selectedEngineerData.cesPercent.toFixed(1)}% (${(selectedEngineerData.cesPercent - avgCES).toFixed(1)} points above average). Perfect candidate for mentoring program and customer escalation handling.`,
                                    color: "green",
                                    priority: "recognition"
                                  });
                                }

                                // 2. Workload & Efficiency Analysis
                                const volumeRatio = selectedEngineerData.closed / avgClosed;
                                const responseRatio = selectedEngineerData.avgPcc / avgResponseTime;

                                if (volumeRatio > 1.4) {
                                  recommendations.push({
                                    title: "⚖️ Workload Balance Review",
                                    message: `High volume (${selectedEngineerData.closed} tickets, ${(volumeRatio * 100 - 100).toFixed(0)}% above average). Monitor for burnout signs and ensure quality isn't compromised. Consider workload redistribution.`,
                                    color: "orange",
                                    priority: "medium"
                                  });
                                } else if (volumeRatio < 0.7) {
                                  recommendations.push({
                                    title: "🚀 Capacity Expansion",
                                    message: `Lower volume (${selectedEngineerData.closed} tickets) with good performance suggests capacity for additional responsibilities. Consider complex ticket assignments or cross-training.`,
                                    color: "blue",
                                    priority: "opportunity"
                                  });
                                }

                                if (responseRatio > 1.5) {
                                  recommendations.push({
                                    title: "⏱️ Response Time Acceleration",
                                    message: `Response time of ${(selectedEngineerData.avgPcc / 24).toFixed(1)} days is ${((selectedEngineerData.avgPcc - avgResponseTime) / 24).toFixed(1)} days slower than average. Implement time-blocking, knowledge base shortcuts, and template responses.`,
                                    color: "orange",
                                    priority: "high"
                                  });
                                } else if (responseRatio < 0.7) {
                                  recommendations.push({
                                    title: "⚡ Speed Excellence",
                                    message: `Excellent response time of ${(selectedEngineerData.avgPcc / 24).toFixed(1)} days. Share time management techniques with slower responders and consider handling priority escalations.`,
                                    color: "green",
                                    priority: "recognition"
                                  });
                                }

                                // 3. Resolution Efficiency Deep Dive
                                if (selectedEngineerData.closedEqual1 < 25) {
                                  recommendations.push({
                                    title: "🎯 Quick Resolution Training",
                                    message: `Only ${selectedEngineerData.closedEqual1.toFixed(1)}% same-day resolution rate. Focus on triage skills, common issue patterns, and automated response tools to improve quick wins.`,
                                    color: "yellow",
                                    priority: "medium"
                                  });
                                } else if (selectedEngineerData.closedEqual1 > 50) {
                                  recommendations.push({
                                    title: "🏆 Resolution Speed Champion",
                                    message: `Exceptional same-day resolution rate of ${selectedEngineerData.closedEqual1.toFixed(1)}%. Consider as trainer for efficiency best practices and triage techniques.`,
                                    color: "green",
                                    priority: "recognition"
                                  });
                                }

                                if (selectedEngineerData.closedLessThan7 < 60) {
                                  recommendations.push({
                                    title: "📅 Weekly Resolution Focus",
                                    message: `Weekly resolution rate of ${selectedEngineerData.closedLessThan7.toFixed(1)}% needs improvement. Implement daily ticket review processes and escalation protocols for complex issues.`,
                                    color: "yellow",
                                    priority: "medium"
                                  });
                                }

                                // 4. Customer Engagement Analysis
                                if (selectedEngineerData.surveyCount < avgSurveyCount * 0.6) {
                                  recommendations.push({
                                    title: "📋 Survey Collection Enhancement",
                                    message: `Low survey collection (${selectedEngineerData.surveyCount} vs ${avgSurveyCount.toFixed(1)} average). Implement follow-up email automation and teach customers about feedback importance.`,
                                    color: "indigo",
                                    priority: "medium"
                                  });
                                } else if (selectedEngineerData.surveyCount > avgSurveyCount * 1.3) {
                                  recommendations.push({
                                    title: "💬 Customer Engagement Expert",
                                    message: `High survey collection rate (${selectedEngineerData.surveyCount}). Share customer engagement techniques with team to improve overall feedback collection.`,
                                    color: "green",
                                    priority: "recognition"
                                  });
                                }

                                // 5. Specialization & Development
                                if (selectedEngineerData.technicalPercent > avgTechnical + 20) {
                                  recommendations.push({
                                    title: "🔧 Technical Specialist Track",
                                    message: `High technical focus (${selectedEngineerData.technicalPercent.toFixed(1)}% vs ${avgTechnical.toFixed(1)}% average). Consider advanced technical training, API documentation roles, or developer relations.`,
                                    color: "purple",
                                    priority: "development"
                                  });
                                } else if (selectedEngineerData.technicalPercent < avgTechnical - 20) {
                                  recommendations.push({
                                    title: "📚 Technical Skills Development",
                                    message: `Lower technical exposure (${selectedEngineerData.technicalPercent.toFixed(1)}%). Consider technical training sessions, pairing with technical specialists, or gradual technical ticket assignment.`,
                                    color: "blue",
                                    priority: "development"
                                  });
                                }

                                if (selectedEngineerData.enterprisePercent > avgEnterprise + 15) {
                                  recommendations.push({
                                    title: "🏢 Enterprise Excellence",
                                    message: `Strong enterprise focus (${selectedEngineerData.enterprisePercent.toFixed(1)}% vs ${avgEnterprise.toFixed(1)}% average). Perfect for account management training and high-value customer relationships.`,
                                    color: "purple",
                                    priority: "development"
                                  });
                                }

                                // 6. Quality & Communication Analysis
                                if (selectedEngineerData.participationRate < avgParticipation * 0.8) {
                                  recommendations.push({
                                    title: "🎯 Quality Improvement Program",
                                    message: `Quality score of ${selectedEngineerData.participationRate.toFixed(1)} is below average (${avgParticipation.toFixed(1)}). Focus on solution documentation, customer communication clarity, and peer review processes.`,
                                    color: "yellow",
                                    priority: "medium"
                                  });
                                } else if (selectedEngineerData.participationRate > avgParticipation + 0.5) {
                                  recommendations.push({
                                    title: "⭐ Quality Leader",
                                    message: `Excellent quality score of ${selectedEngineerData.participationRate.toFixed(1)}. Consider for quality assurance role, new hire training, and best practice documentation.`,
                                    color: "green",
                                    priority: "recognition"
                                  });
                                }

                                // 7. Workload Management Insights
                                if (selectedEngineerData.openGreaterThan14 > 5) {
                                  recommendations.push({
                                    title: "📊 Backlog Management",
                                    message: `${selectedEngineerData.openGreaterThan14} tickets open >14 days indicates backlog issues. Implement daily ticket review, escalation protocols, and time-boxing for complex issues.`,
                                    color: "orange",
                                    priority: "high"
                                  });
                                } else if (selectedEngineerData.openGreaterThan14 === 0) {
                                  recommendations.push({
                                    title: "📈 Backlog Management Expert",
                                    message: `Zero long-term open tickets shows excellent workflow management. Share time management and prioritization techniques with team members.`,
                                    color: "green",
                                    priority: "recognition"
                                  });
                                }

                                // 8. Performance-Based Career Development
                                const isTopPerformer = selectedEngineerData.cesPercent > avgCES + 10 &&
                                                     selectedEngineerData.closed > avgClosed * 0.9 &&
                                                     selectedEngineerData.avgPcc < avgResponseTime * 1.2;

                                const needsImprovement = selectedEngineerData.cesPercent < avgCES - 10 ||
                                                       selectedEngineerData.avgPcc > avgResponseTime * 1.5;

                                if (isTopPerformer) {
                                  recommendations.push({
                                    title: "🎖️ Leadership Development Path",
                                    message: `Consistently excellent across all metrics. Recommend for senior support role, team leadership training, customer success management, or technical documentation ownership.`,
                                    color: "green",
                                    priority: "career"
                                  });
                                } else if (needsImprovement) {
                                  recommendations.push({
                                    title: "📋 Performance Improvement Plan",
                                    message: `Multiple metrics below expectations. Implement weekly 1-on-1s, skill-specific training modules, and measurable improvement goals with regular check-ins.`,
                                    color: "red",
                                    priority: "improvement"
                                  });
                                }

                                // 9. Balanced Development Recommendations
                                if (recommendations.filter(r => r.priority === "recognition").length === 0 &&
                                    recommendations.filter(r => r.priority === "critical" || r.priority === "high").length === 0) {
                                  recommendations.push({
                                    title: "🔄 Continuous Development",
                                    message: `Solid performance across metrics. Focus on cross-training in different support areas, advanced communication techniques, or specialized certification programs for career growth.`,
                                    color: "blue",
                                    priority: "development"
                                  });
                                }

                                // Sort by priority
                                const priorityOrder = {
                                  critical: 6,
                                  high: 5,
                                  improvement: 4,
                                  medium: 3,
                                  development: 2,
                                  opportunity: 2,
                                  recognition: 1,
                                  career: 1
                                };

                                recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

                                // Limit to top 5 recommendations
                                const topRecommendations = recommendations.slice(0, 5);

                                const colorClasses = {
                                  red: "bg-red-50 border-red-500 text-red-900 text-red-800",
                                  yellow: "bg-yellow-50 border-yellow-500 text-yellow-900 text-yellow-800",
                                  green: "bg-green-50 border-green-500 text-green-900 text-green-800",
                                  blue: "bg-blue-50 border-blue-500 text-blue-900 text-blue-800",
                                  purple: "bg-purple-50 border-purple-500 text-purple-900 text-purple-800",
                                  orange: "bg-orange-50 border-orange-500 text-orange-900 text-orange-800",
                                  indigo: "bg-indigo-50 border-indigo-500 text-indigo-900 text-indigo-800"
                                };

                                const priorityColors = {
                                  critical: "bg-red-600 text-white",
                                  high: "bg-red-500 text-white",
                                  improvement: "bg-red-400 text-white",
                                  medium: "bg-yellow-500 text-white",
                                  development: "bg-blue-500 text-white",
                                  opportunity: "bg-green-500 text-white",
                                  recognition: "bg-green-600 text-white",
                                  career: "bg-purple-600 text-white"
                                };

                                return topRecommendations.map((rec, index) => (
                                  <div key={index} className={`p-4 rounded-lg border-l-4 ${colorClasses[rec.color].split(' ').slice(0, 2).join(' ')}`}>
                                    <div className={`font-semibold mb-1 ${colorClasses[rec.color].split(' ')[2]} flex items-center justify-between`}>
                                      <span>{rec.title}</span>
                                      <span className={`text-xs px-2 py-1 rounded font-medium ${priorityColors[rec.priority]}`}>
                                        {rec.priority.toUpperCase()}
                                      </span>
                                    </div>
                                    <div className={`text-sm ${colorClasses[rec.color].split(' ')[3]} leading-relaxed`}>
                                      {rec.message}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Individual Detailed Analytics */}
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-6">
                            Detailed Performance Metrics
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Surveys Received
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.surveyCount}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Technical %
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.technicalPercent.toFixed(
                                  1,
                                )}
                                %
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Enterprise %
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.enterprisePercent.toFixed(
                                  1,
                                )}
                                %
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Open Tickets
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.open}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Tickets &gt;14 Days
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.openGreaterThan14}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Resolved in 1 Day
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.closedEqual1.toFixed(1)}%
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Resolved &lt;7 Days
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.closedLessThan7.toFixed(
                                  1,
                                )}
                                %
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-500 mb-1">
                                Quality Score
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {selectedEngineerData.participationRate.toFixed(
                                  1,
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </TabsContent>
              </Tabs>
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
