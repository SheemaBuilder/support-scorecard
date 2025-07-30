// Frontend-only database functions for reading from Supabase
// No direct Zendesk API calls - only reads from database

import { supabase } from './supabase';
import { EngineerMetrics } from './types';

// Function to get latest metrics from database (frontend-safe)
export async function getLatestMetricsFromDatabase(
  startDate?: Date,
  endDate?: Date,
  tableName?: string
): Promise<{ engineerData: EngineerMetrics[], averageMetrics: EngineerMetrics | null }> {
  try {
    console.log('🔍 Fetching metrics from database...', { startDate, endDate, tableName });

    // Detect which schema we're using
    let useOldSchema = false;

    // Determine which table to query
    let metricsTableName = tableName || 'engineer_metrics';
    let shouldFallback = false;

    console.log('📊 Initial table selection:', metricsTableName);

    if (!tableName) {
      console.warn('⚠️ No tableName provided! This might indicate the monthly table structure is not working correctly.');
      console.warn('⚠️ Expected table names like: engineer_metrics_july_2025');
    } else {
      console.log(`🔍 Attempting to query monthly table: ${tableName}`);

      // Check if the monthly table exists
      try {
        const { data: tableCheck, error: tableCheckError } = await supabase
          .from(metricsTableName)
          .select('engineer_zendesk_id')
          .limit(1);

        if (tableCheckError) {
          console.error(`❌ Monthly table ${metricsTableName} does not exist or has an error:`, tableCheckError);
          console.log('💡 TIP: Run MONTHLY_TABLES_SETUP_FIXED.sql to create monthly tables');
          console.log('🔄 Falling back to main engineer_metrics table...');

          // Fall back to main table if monthly table doesn't exist
          metricsTableName = 'engineer_metrics';
          shouldFallback = true;
        } else {
          console.log(`✅ Monthly table ${metricsTableName} exists and is accessible`);
        }
      } catch (err) {
        console.error(`❌ Error checking monthly table ${metricsTableName}:`, err);
        console.log('🔄 Falling back to main engineer_metrics table...');
        metricsTableName = 'engineer_metrics';
        shouldFallback = true;
      }
    }

    console.log('📊 Final table selection:', metricsTableName);

    // Debug Supabase configuration
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    console.log('🔗 Supabase config check:', {
      hasUrl: !!supabaseUrl,
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
      fullUrl: supabaseUrl, // Show full URL for debugging
      hasKey: !!supabaseKey,
      keyPreview: supabaseKey ? `${supabaseKey.substring(0, 15)}...` : 'MISSING',
      supabaseType: typeof supabase,
      fromMethod: typeof supabase.from
    });

    // Validate URL format
    if (supabaseUrl && !supabaseUrl.includes('supabase.co')) {
      console.warn('⚠️ Supabase URL might be invalid. Expected format: https://xxxxx.supabase.co');
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase environment variables not found!');
      console.error('Please create a .env file with:');
      console.error('VITE_SUPABASE_URL=https://your-project.supabase.co');
      console.error('VITE_SUPABASE_ANON_KEY=your-anon-key');
      console.log('❌ Environment not configured, returning empty data for hook fallback');
      return { engineerData: [], averageMetrics: null };
    }

    // Simplified connection test - skipping problematic fetch operations
    console.log('🔍 Proceeding with direct Supabase queries...');
    console.log('🔗 Supabase client type:', typeof supabase);
    console.log('🔗 Supabase from method:', typeof supabase.from);

    // Validate that supabase client has required methods
    if (!supabase.from || typeof supabase.from !== 'function') {
      console.error('❌ Supabase client not properly initialized');
      return { engineerData: [], averageMetrics: null };
    }

    // Now check if we have ANY metrics data at all
    console.log(`🔍 Step 1: Checking if any data exists in ${metricsTableName}...`);

    // If we fell back to main table, assume old schema
    if (shouldFallback) {
      useOldSchema = true;
      console.log('🔄 Using fallback table, assuming old schema');
    }

    // Try new schema first (unless we already know it's old schema)
    let { data: anyMetrics, error: countError } = await supabase
      .from(metricsTableName)
      .select(useOldSchema ? 'engineer_id' : 'engineer_zendesk_id')
      .limit(1);

    console.log('🔍 Step 1 result:', {
      anyMetrics,
      countError,
      schema: useOldSchema ? 'old (UUID)' : 'new (zendesk_id)',
      table: metricsTableName
    });

    // If we didn't fallback and new schema failed, try old schema
    if (!shouldFallback && countError) {
      console.log('🔍 Trying old schema with engineer_id...');
      const { data: oldMetrics, error: oldError } = await supabase
        .from(metricsTableName)
        .select('engineer_id')
        .limit(1);
      console.log('🔍 Step 1 (old schema) result:', { oldMetrics, oldError });

      if (!oldError && oldMetrics) {
        console.log('🚨 FOUND: Database still uses old schema with engineer_id (UUID)');
        console.log('💡 TIP: Run SUPABASE_CLEANUP.sql to migrate to simplified schema');
        useOldSchema = true;
        anyMetrics = oldMetrics;
        countError = null;
      }
    }

    if (countError) {
      const { safeErrorToString } = await import('./supabase');
      const errorMessage = safeErrorToString(countError);
      console.error('❌ Count query failed:', errorMessage);
      console.error('❌ Full error object:', countError);
      console.error('❌ Error details:', {
        message: countError?.message || 'No message',
        details: countError?.details || 'No details',
        hint: countError?.hint || 'No hint',
        code: countError?.code || 'No code',
        stack: countError?.stack || 'No stack'
      });

      // Check if this is a configuration issue
      if (countError?.message?.includes('Failed to fetch') || countError?.name === 'TypeError') {
        console.log('❌ Supabase connection failed (config/network issue), returning empty data for fallback');
        return { engineerData: [], averageMetrics: null };
      }

      console.log('❌ Database connection failed, returning empty data for fallback');
      return { engineerData: [], averageMetrics: null };
    }

    if (!anyMetrics || anyMetrics.length === 0) {
      console.log('⚠️ No engineer_metrics found in database at all');
      return { engineerData: [], averageMetrics: null };
    }

    console.log('✅ Found engineer_metrics in database, proceeding with full query...');

    // Show date range available in database to help debug
    const { data: dateRangeCheck } = await supabase
      .from(metricsTableName)
      .select('calculated_at')
      .order('calculated_at', { ascending: false })
      .limit(1);
    const { data: oldestDateCheck } = await supabase
      .from(metricsTableName)
      .select('calculated_at')
      .order('calculated_at', { ascending: true })
      .limit(1);

    if (dateRangeCheck && oldestDateCheck) {
      console.log('�� Available data range in database:', {
        newest: dateRangeCheck[0]?.calculated_at,
        oldest: oldestDateCheck[0]?.calculated_at
      });
    }

    // Step 2: Get engineers first
    console.log('🔍 Step 2a: Fetching engineers...');
    const engineerSelectFields = useOldSchema ? 'id, zendesk_id, name' : 'zendesk_id, name';
    const { data: engineers, error: engineersError } = await supabase
      .from('engineers')
      .select(engineerSelectFields);

    if (engineersError) {
      const { safeErrorToString } = await import('./supabase');
      const errorMessage = safeErrorToString(engineersError);
      console.error('❌ Engineers query failed:', errorMessage);
      console.error('❌ Engineers error details:', {
        message: engineersError?.message || 'No message',
        details: engineersError?.details || 'No details',
        hint: engineersError?.hint || 'No hint',
        code: engineersError?.code || 'No code'
      });

      // Return empty data instead of throwing to allow hook fallback
      console.log('❌ Returning empty data due to engineers query failure');
      return { engineerData: [], averageMetrics: null };
    }

    if (!engineers || engineers.length === 0) {
      console.log('⚠️ No engineers found in database');
      return { engineerData: [], averageMetrics: null };
    }

    console.log(`✅ Found ${engineers.length} engineers`);

    // Debug: Show what calculated_at dates are available
    console.log(`🔍 Step 2a-debug: Checking what dates are available in ${metricsTableName}...`);
    const { data: dateCheck } = await supabase
      .from(metricsTableName)
      .select('calculated_at, period_start, period_end')
      .order('calculated_at', { ascending: false })
      .limit(10);

    if (dateCheck && dateCheck.length > 0) {
      console.log('📅 Available dates in database:', dateCheck.map(d => ({
        calculated_at: d.calculated_at,
        period_start: d.period_start,
        period_end: d.period_end
      })));

      const latestDate = dateCheck[0].calculated_at;
      const oldestDate = dateCheck[dateCheck.length - 1].calculated_at;
      console.log('📅 Date range in database:', {
        latest: latestDate,
        oldest: oldestDate,
        totalRecords: dateCheck.length
      });
    } else {
      console.log('⚠️ No dates found in database');
    }

    // Step 2b: Get metrics with proper date filtering
    console.log('🔍 Step 2b: Fetching engineer_metrics...');
    const metricsSelectFields = useOldSchema
      ? `engineer_id,
         ces_percent,
         avg_pcc,
         closed,
         open,
         open_greater_than_14,
         closed_less_than_7,
         closed_equal_1,
         participation_rate,
         link_count,
         citation_count,
         creation_count,
         enterprise_percent,
         technical_percent,
         survey_count,
         period_start,
         period_end,
         calculated_at`
      : `engineer_zendesk_id,
         ces_percent,
         avg_pcc,
         closed,
         open,
         open_greater_than_14,
         closed_less_than_7,
         closed_equal_1,
         participation_rate,
         link_count,
         citation_count,
         creation_count,
         enterprise_percent,
         technical_percent,
         survey_count,
         period_start,
         period_end,
         calculated_at`;

    let metricsQuery = supabase
      .from(metricsTableName)
      .select(metricsSelectFields);

    // Debug the date filtering issue
    console.log('🔧 DEBUG: Checking date filtering for technical_percent issue');
    console.log('📅 Requested date filter:', {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    });

    // Apply date filtering if provided (RE-ENABLED)
    if (startDate && endDate) {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      console.log('📅 Applying date filter to metrics query:', {
        startDateStr,
        endDateStr,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        filterDescription: `Looking for metrics where calculated_at is between ${startDateStr} and ${endDateStr}`
      });

      // Filter by when the metrics were calculated (more direct approach)
      metricsQuery = metricsQuery
        .gte('calculated_at', startDate.toISOString())
        .lte('calculated_at', endDate.toISOString());

      console.log('📅 Date filter applied: calculated_at >= ', startDate.toISOString(), ' AND calculated_at <= ', endDate.toISOString());
    } else {
      console.log('📅 No date filter applied - showing ALL metrics to debug technical_percent issue');
    }

    const { data: metrics, error: metricsError } = await metricsQuery
      .order('calculated_at', { ascending: false })
      .limit(500); // Increased limit to ensure we get data across different periods

    if (metricsError) {
      const { safeErrorToString } = await import('./supabase');
      const errorMessage = safeErrorToString(metricsError);
      console.error('❌ Metrics query failed:', errorMessage);
      console.error('❌ Metrics error details:', {
        message: metricsError?.message || 'No message',
        details: metricsError?.details || 'No details',
        hint: metricsError?.hint || 'No hint',
        code: metricsError?.code || 'No code',
        stack: metricsError?.stack || 'No stack'
      });

      // Return empty data instead of throwing to allow hook fallback
      console.log('❌ Returning empty data due to metrics query failure');
      return { engineerData: [], averageMetrics: null };
    }

    if (!metrics || metrics.length === 0) {
      console.log('⚠️ No metrics found for the selected date range');
      if (startDate && endDate) {
        console.log('📅 Date range that returned no results:', {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          startFormatted: startDate.toISOString().split('T')[0],
          endFormatted: endDate.toISOString().split('T')[0]
        });
      }
      return { engineerData: [], averageMetrics: null };
    }

    console.log(`✅ Found ${metrics.length} metric records for date range`);
    if (startDate && endDate) {
      console.log('📅 Successful date filter:', {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        metricsFound: metrics.length
      });
    }

    // Debug raw metrics data for technical_percent issue
    console.log('🔧 Technical percent in raw data:', metrics.map(m => ({
      engineer_ref: useOldSchema ? m.engineer_id : m.engineer_zendesk_id,
      technical_percent: m.technical_percent,
      calculated_at: m.calculated_at?.split('T')[0] // Just the date part
    })).slice(0, 10));

    // Create engineer mapping based on schema
    const engineerMap = new Map();
    const engineerIdMap = new Map(); // For old schema UUID to zendesk_id mapping

    engineers.forEach(eng => {
      if (useOldSchema) {
        engineerMap.set(eng.id, eng.name); // Map UUID to name
        engineerIdMap.set(eng.id, eng.zendesk_id); // Map UUID to zendesk_id
      } else {
        engineerMap.set(eng.zendesk_id, eng.name); // Map zendesk_id to name
      }
    });

    // Group by engineer identifier and take the most recent for each
    const latestByEngineer = new Map();
    metrics.forEach(item => {
      const engineerKey = useOldSchema ? item.engineer_id : item.engineer_zendesk_id;
      const existing = latestByEngineer.get(engineerKey);
      if (!existing || new Date(item.calculated_at) > new Date(existing.calculated_at)) {
        latestByEngineer.set(engineerKey, item);
      }
    });

    console.log('🔧 Selected latest metrics (technical_percent focus):', Array.from(latestByEngineer.values()).map(m => ({
      engineer_key: useOldSchema ? m.engineer_id : m.engineer_zendesk_id,
      technical_percent: m.technical_percent,
      calculated_at: m.calculated_at?.split('T')[0]
    })));

    // Transform the data, joining with engineer names
    const data = Array.from(latestByEngineer.values())
      .filter(item => {
        const engineerKey = useOldSchema ? item.engineer_id : item.engineer_zendesk_id;
        return engineerMap.has(engineerKey);
      })
      .map(item => {
        const engineerKey = useOldSchema ? item.engineer_id : item.engineer_zendesk_id;
        return {
          name: engineerMap.get(engineerKey),
          ces_percent: item.ces_percent,
          avg_pcc: item.avg_pcc,
          closed: item.closed,
          open: item.open,
          open_greater_than_14: item.open_greater_than_14,
          closed_less_than_7: item.closed_less_than_7,
          closed_equal_1: item.closed_equal_1,
          participation_rate: item.participation_rate,
          link_count: item.link_count,
          citation_count: item.citation_count,
          creation_count: item.creation_count,
          enterprise_percent: item.enterprise_percent,
          technical_percent: item.technical_percent,
          survey_count: item.survey_count,
        };
      });

    console.log(`📊 Final data: ${data.length} unique engineers with metrics`);
    console.log('📊 Sample data:', data[0]);

    // Debug technical_percent values specifically
    console.log('🔧 Technical percent debug:', data.map(d => ({
      name: d.name,
      technical_percent: d.technical_percent,
      enterprise_percent: d.enterprise_percent
    })));

    if (!data || data.length === 0) {
      console.log('⚠️ No metrics found after filtering');
      return { engineerData: [], averageMetrics: null };
    }

    // Convert to EngineerMetrics format
    const engineerData: EngineerMetrics[] = data.map(metric => ({
      name: metric.name,
      cesPercent: metric.ces_percent || 0,
      avgPcc: metric.avg_pcc || 0,
      closed: metric.closed || 0,
      open: metric.open || 0,
      openGreaterThan14: metric.open_greater_than_14 || 0,
      closedLessThan7: metric.closed_less_than_7 || 0,
      closedEqual1: metric.closed_equal_1 || 0,
      participationRate: metric.participation_rate || 0,
      linkCount: metric.link_count || 0,
      citationCount: metric.citation_count || 0,
      creationCount: metric.creation_count || 0,
      enterprisePercent: metric.enterprise_percent || 0,
      technicalPercent: metric.technical_percent || 0,
      surveyCount: metric.survey_count || 0,
    }));

    console.log('📊 Final engineerData:', { count: engineerData.length, sample: engineerData[0] });

    // Calculate team averages
    const averageMetrics = calculateTeamAverages(engineerData);

    console.log('📊 Team averages calculated:', averageMetrics);

    return { engineerData, averageMetrics };

  } catch (error) {
    const { safeErrorToString } = await import('./supabase');
    const errorMessage = safeErrorToString(error);
    console.error('❌ Failed to get metrics from database:', errorMessage);

    // If we can't get metrics, let's at least check if tables exist
    try {
      const { data: tableCheck } = await supabase
        .from('engineers')
        .select('count')
        .limit(1);
      console.log('📊 Engineers table accessible:', !!tableCheck);
    } catch (tableError) {
      const tableErrorMessage = safeErrorToString(tableError);
      console.error('❌ Engineers table not accessible:', tableErrorMessage);
    }

    return { engineerData: [], averageMetrics: null };
  }
}

// Helper function to calculate team averages (frontend-safe)
function calculateTeamAverages(engineerMetrics: EngineerMetrics[]): EngineerMetrics | null {
  if (engineerMetrics.length === 0) return null;

  const averages = engineerMetrics.reduce(
    (acc, engineer) => ({
      cesPercent: acc.cesPercent + engineer.cesPercent,
      avgPcc: acc.avgPcc + engineer.avgPcc,
      closed: acc.closed + engineer.closed,
      open: acc.open + engineer.open,
      openGreaterThan14: acc.openGreaterThan14 + engineer.openGreaterThan14,
      closedLessThan7: acc.closedLessThan7 + engineer.closedLessThan7,
      closedEqual1: acc.closedEqual1 + engineer.closedEqual1,
      participationRate: acc.participationRate + engineer.participationRate,
      linkCount: acc.linkCount + engineer.linkCount,
      citationCount: acc.citationCount + engineer.citationCount,
      creationCount: acc.creationCount + engineer.creationCount,
      enterprisePercent: acc.enterprisePercent + engineer.enterprisePercent,
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

  const count = engineerMetrics.length;

  return {
    name: "Team Average",
    cesPercent: averages.cesPercent / count,
    avgPcc: averages.avgPcc / count,
    closed: Math.round(averages.closed / count),
    open: averages.open / count,
    openGreaterThan14: averages.openGreaterThan14 / count,
    closedLessThan7: averages.closedLessThan7 / count,
    closedEqual1: averages.closedEqual1 / count,
    participationRate: averages.participationRate / count,
    linkCount: averages.linkCount / count,
    citationCount: averages.citationCount / count,
    creationCount: averages.creationCount / count,
    enterprisePercent: averages.enterprisePercent / count,
    technicalPercent: averages.technicalPercent / count,
    surveyCount: averages.surveyCount / count,
  };
}
