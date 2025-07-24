import { supabase, Engineer, Ticket, EngineerMetric } from './supabase';
import { fetchAllEngineerMetrics, getUsers, getTickets, calculateEngineerMetrics } from './zendesk-api';
import { EngineerMetrics } from './types';

// Target engineers (from zendesk-api.ts)
const TARGET_ENGINEERS = new Map([
  ["Jared Beckler", 29215234714775],
  ["Rahul Joshi", 29092423638935],
  ["Parth Sharma", 29092389569431],
  ["Fernando Duran", 24100359866391],
  ["Alex Bridgeman", 19347232342679],
  ["Sheema Parwaz", 16211207272855],
  ["Manish Sharma", 5773445002519],
  ["Akash Singh", 26396676511767],
]);

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

export class DataSyncService {
  private onProgress?: (progress: SyncProgress) => void;

  constructor(onProgress?: (progress: SyncProgress) => void) {
    this.onProgress = onProgress;
  }

  private reportProgress(step: string, current: number, total: number, message: string) {
    if (this.onProgress) {
      this.onProgress({ step, current, total, message });
    }
    console.log(`[${step}] ${current}/${total}: ${message}`);
  }

  async syncAllData(startDate?: Date, endDate?: Date): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let engineersProcessed = 0;
    let ticketsProcessed = 0;
    let metricsCalculated = 0;

    try {
      this.reportProgress('init', 0, 100, 'Starting data sync...');

      // Step 1: Fetch data from Zendesk
      this.reportProgress('fetch', 10, 100, 'Fetching users from Zendesk...');
      const zendeskUsers = await getUsers();
      
      this.reportProgress('fetch', 30, 100, 'Fetching tickets from Zendesk...');
      const zendeskTickets = await getTickets(startDate, endDate);

      // Step 2: Sync Engineers
      this.reportProgress('engineers', 40, 100, 'Syncing engineers to database...');
      const filteredUsers = zendeskUsers.filter(user => 
        TARGET_ENGINEERS.has(user.name) && TARGET_ENGINEERS.get(user.name) === user.id
      );

      for (const user of filteredUsers) {
        await this.upsertEngineer(user);
        engineersProcessed++;
      }

      // Step 3: Sync Tickets
      this.reportProgress('tickets', 60, 100, 'Syncing tickets to database...');
      const batchSize = 100;
      for (let i = 0; i < zendeskTickets.length; i += batchSize) {
        const batch = zendeskTickets.slice(i, i + batchSize);
        await this.upsertTicketsBatch(batch);
        ticketsProcessed += batch.length;
        
        this.reportProgress(
          'tickets', 
          60 + (i / zendeskTickets.length) * 20, 
          100, 
          `Synced ${ticketsProcessed}/${zendeskTickets.length} tickets...`
        );
      }

      // Step 4: Calculate and store metrics
      this.reportProgress('metrics', 80, 100, 'Calculating engineer metrics...');
      const engineerMetrics = await this.calculateAndStoreMetrics(filteredUsers, zendeskTickets, startDate, endDate);
      metricsCalculated = engineerMetrics.length;

      this.reportProgress('complete', 100, 100, 'Data sync completed successfully!');

      const duration = Date.now() - startTime;
      return {
        success: true,
        engineersProcessed,
        ticketsProcessed,
        metricsCalculated,
        errors,
        duration
      };

    } catch (error) {
      console.error('Data sync failed:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      const duration = Date.now() - startTime;
      return {
        success: false,
        engineersProcessed,
        ticketsProcessed,
        metricsCalculated,
        errors,
        duration
      };
    }
  }

  async syncIncrementalData(): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      this.reportProgress('incremental', 0, 100, 'Starting incremental sync...');

      // Get the last sync time
      const { data: lastMetrics } = await supabase
        .from('engineer_metrics')
        .select('calculated_at')
        .order('calculated_at', { ascending: false })
        .limit(1);

      const lastSyncTime = lastMetrics && lastMetrics.length > 0 
        ? new Date(lastMetrics[0].calculated_at)
        : new Date('2025-01-01'); // Default to start of 2025

      this.reportProgress('incremental', 20, 100, `Syncing data since ${lastSyncTime.toISOString()}...`);

      // Sync data from last sync time to now
      return await this.syncAllData(lastSyncTime, new Date());

    } catch (error) {
      console.error('Incremental sync failed:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      const duration = Date.now() - startTime;
      return {
        success: false,
        engineersProcessed: 0,
        ticketsProcessed: 0,
        metricsCalculated: 0,
        errors,
        duration
      };
    }
  }

  private async upsertEngineer(zendeskUser: any): Promise<void> {
    const engineer: Omit<Engineer, 'id' | 'created_at' | 'updated_at'> = {
      zendesk_id: zendeskUser.id,
      name: zendeskUser.name,
      email: zendeskUser.email,
      role: zendeskUser.role || 'engineer',
      active: zendeskUser.active ?? true,
    };

    const { error } = await supabase
      .from('engineers')
      .upsert(engineer, { 
        onConflict: 'zendesk_id',
        ignoreDuplicates: false 
      });

    if (error) {
      if (error.message.includes('row-level security policy')) {
        throw new Error(`Failed to upsert engineer ${engineer.name}: Row Level Security policy error. Please run the fix-rls-policies.sql script in your Supabase dashboard, or disable RLS for development using disable-rls-for-dev.sql. Error: ${error.message}`);
      }
      throw new Error(`Failed to upsert engineer ${engineer.name}: ${error.message}`);
    }
  }

  private async upsertTicketsBatch(zendeskTickets: any[]): Promise<void> {
    const tickets = zendeskTickets.map(ticket => ({
      zendesk_id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      assignee_id: ticket.assignee_id,
      requester_id: ticket.requester_id,
      submitter_id: ticket.submitter_id,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      solved_at: ticket.solved_at,
      tags: ticket.tags || [],
      custom_fields: ticket.custom_fields || []
    }));

    const { error } = await supabase
      .from('tickets')
      .upsert(tickets, { 
        onConflict: 'zendesk_id',
        ignoreDuplicates: false 
      });

    if (error) {
      if (error.message.includes('row-level security policy')) {
        throw new Error(`Failed to upsert tickets batch: Row Level Security policy error. Please run the fix-rls-policies.sql script in your Supabase dashboard. Error: ${error.message}`);
      }
      throw new Error(`Failed to upsert tickets batch: ${error.message}`);
    }
  }

  private async calculateAndStoreMetrics(
    engineers: any[], 
    allTickets: any[], 
    startDate?: Date, 
    endDate?: Date
  ): Promise<EngineerMetrics[]> {
    const metrics: EngineerMetrics[] = [];

    // Get engineer IDs from database
    const { data: dbEngineers } = await supabase
      .from('engineers')
      .select('id, zendesk_id, name')
      .in('zendesk_id', engineers.map(e => e.id));

    if (!dbEngineers) {
      throw new Error('Failed to fetch engineers from database');
    }

    for (const engineer of engineers) {
      const dbEngineer = dbEngineers.find(e => e.zendesk_id === engineer.id);
      if (!dbEngineer) continue;

      // Calculate metrics using existing logic
      const engineerMetrics = calculateEngineerMetrics(engineer, allTickets);
      metrics.push(engineerMetrics);

      // Store in database
      const metricRecord: Omit<EngineerMetric, 'id' | 'calculated_at'> = {
        engineer_id: dbEngineer.id,
        period_start: (startDate || new Date('2025-01-01')).toISOString().split('T')[0],
        period_end: (endDate || new Date()).toISOString().split('T')[0],
        ces_percent: engineerMetrics.cesPercent,
        avg_pcc: engineerMetrics.avgPcc,
        closed: engineerMetrics.closed,
        open: engineerMetrics.open,
        open_greater_than_14: engineerMetrics.openGreaterThan14,
        closed_less_than_7: engineerMetrics.closedLessThan7,
        closed_equal_1: engineerMetrics.closedEqual1,
        participation_rate: engineerMetrics.participationRate,
        link_count: engineerMetrics.linkCount,
        citation_count: engineerMetrics.citationCount,
        creation_count: engineerMetrics.creationCount,
        enterprise_percent: engineerMetrics.enterprisePercent,
        technical_percent: engineerMetrics.technicalPercent,
        survey_count: engineerMetrics.surveyCount,
      };

      const { error } = await supabase
        .from('engineer_metrics')
        .upsert(metricRecord, {
          onConflict: 'engineer_id,period_start,period_end',
          ignoreDuplicates: false
        });

      if (error) {
        if (error.message.includes('row-level security policy')) {
          throw new Error(`Failed to store metrics for ${engineer.name}: Row Level Security policy error. Please run the fix-rls-policies.sql script in your Supabase dashboard. Error: ${error.message}`);
        }
        throw new Error(`Failed to store metrics for ${engineer.name}: ${error.message}`);
      }
    }

    return metrics;
  }
}

// Standalone functions for use in components
export async function syncAllDataFromZendesk(
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const syncService = new DataSyncService(onProgress);
  // Sync all data from 2025
  return await syncService.syncAllData(new Date('2025-01-01'), new Date());
}

export async function syncIncrementalDataFromZendesk(
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const syncService = new DataSyncService(onProgress);
  return await syncService.syncIncrementalData();
}

// Function to get latest metrics from database
export async function getLatestMetricsFromDatabase(
  startDate?: Date,
  endDate?: Date
): Promise<{ engineerData: EngineerMetrics[], averageMetrics: EngineerMetrics | null }> {
  try {
    console.log('🔍 Fetching metrics from database...', { startDate, endDate });

    // Debug Supabase configuration
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    console.log('🔗 Supabase config check:', {
      hasUrl: !!supabaseUrl,
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
      hasKey: !!supabaseKey,
      keyPreview: supabaseKey ? `${supabaseKey.substring(0, 15)}...` : 'MISSING',
      supabaseType: typeof supabase,
      fromMethod: typeof supabase.from
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase environment variables not found!');
      console.error('Please create a .env file with:');
      console.error('VITE_SUPABASE_URL=https://your-project.supabase.co');
      console.error('VITE_SUPABASE_ANON_KEY=your-anon-key');
      console.log('❌ Environment not configured, returning empty data for hook fallback');
      return { engineerData: [], averageMetrics: null };
    }

    // First, test basic Supabase connectivity with a very simple query
    console.log('🔍 Step 0: Testing basic Supabase connection...');
    try {
      // Test with the simplest possible query first
      console.log('🔗 Testing supabase.from() method...');
      const testQuery = supabase.from('engineers');
      console.log('🔗 Query object created:', typeof testQuery);

      const { data: healthCheck, error: healthError } = await testQuery
        .select('id')
        .limit(1);

      console.log('🔗 Health check response:', { data: healthCheck, error: healthError });

      if (healthError) {
        console.error('❌ Health check failed:', healthError);
        console.error('❌ Error type:', typeof healthError);
        console.error('❌ Error constructor:', healthError.constructor.name);
        throw new Error(`Supabase connection failed: ${healthError.message || JSON.stringify(healthError)}`);
      }
      console.log('✅ Basic Supabase connection successful');
    } catch (error) {
      console.error('❌ Basic connection test failed:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error message:', error?.message);

      // Return empty data instead of throwing to allow hook fallback
      console.log('❌ Connection test failed, returning empty data for hook fallback');
      return { engineerData: [], averageMetrics: null };
    }

    // Now check if we have ANY metrics data at all
    console.log('🔍 Step 1: Checking if any engineer_metrics exist...');
    const { data: anyMetrics, error: countError } = await supabase
      .from('engineer_metrics')
      .select('id')
      .limit(1);

    if (countError) {
      console.error('❌ Count query failed:', countError);
      console.error('❌ Error details:', {
        message: countError?.message || 'No message',
        details: countError?.details || 'No details',
        hint: countError?.hint || 'No hint',
        code: countError?.code || 'No code',
        stack: countError?.stack || 'No stack',
        fullError: JSON.stringify(countError, null, 2)
      });

      // Check if this is a configuration issue
      if (countError?.message?.includes('Failed to fetch') || countError?.name === 'TypeError') {
        throw new Error('Supabase connection failed. Please check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
      }

      throw new Error(`Database connection failed: ${countError?.message || countError || 'Unknown error'}`);
    }

    if (!anyMetrics || anyMetrics.length === 0) {
      console.log('⚠️ No engineer_metrics found in database at all');
      return { engineerData: [], averageMetrics: null };
    }

    console.log('✅ Found engineer_metrics in database, proceeding with full query...');

    // Step 2: Get engineers first
    console.log('🔍 Step 2a: Fetching engineers...');
    const { data: engineers, error: engineersError } = await supabase
      .from('engineers')
      .select('id, zendesk_id, name');

    if (engineersError) {
      console.error('❌ Engineers query failed:', engineersError);
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
    console.log('🔍 Step 2a-debug: Checking what dates are available in database...');
    const { data: dateCheck } = await supabase
      .from('engineer_metrics')
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
    let metricsQuery = supabase
      .from('engineer_metrics')
      .select(`
        engineer_id,
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
        calculated_at
      `);

    // Apply date filtering if provided
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
      console.log('📅 No date filter applied - showing all metrics');
    }

    const { data: metrics, error: metricsError } = await metricsQuery
      .order('calculated_at', { ascending: false })
      .limit(500); // Increased limit to ensure we get data across different periods

    if (metricsError) {
      console.error('❌ Metrics query failed:', metricsError);
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

    // Create a map of engineer_id to engineer name
    const engineerMap = new Map();
    engineers.forEach(eng => {
      engineerMap.set(eng.id, eng.name);
    });

    // Group by engineer_id and take the most recent for each
    const latestByEngineerId = new Map();
    metrics.forEach(item => {
      if (!latestByEngineerId.has(item.engineer_id) ||
          new Date(item.calculated_at) > new Date(latestByEngineerId.get(item.engineer_id).calculated_at)) {
        latestByEngineerId.set(item.engineer_id, item);
      }
    });

    // Transform the data, joining with engineer names
    const data = Array.from(latestByEngineerId.values())
      .filter(item => engineerMap.has(item.engineer_id)) // Only include metrics for known engineers
      .map(item => ({
        name: engineerMap.get(item.engineer_id),
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
      }));

    console.log(`📊 Final data: ${data.length} unique engineers with metrics`);
    console.log('📊 Sample data:', data[0]);

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
    console.error('❌ Failed to get metrics from database:', error);

    // If we can't get metrics, let's at least check if tables exist
    try {
      const { data: tableCheck } = await supabase
        .from('engineers')
        .select('count')
        .limit(1);
      console.log('📊 Engineers table accessible:', !!tableCheck);
    } catch (tableError) {
      console.error('❌ Engineers table not accessible:', tableError);
    }

    return { engineerData: [], averageMetrics: null };
  }
}

// Helper function to calculate team averages
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
