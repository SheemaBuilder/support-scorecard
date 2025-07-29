// Backend/CLI data synchronization functions
// Contains Zendesk API calls - should only be used by sync scripts, NOT frontend

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
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
    // Sync data from the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    return this.syncAllData(startDate, endDate);
  }

  private async upsertEngineer(user: any): Promise<void> {
    const engineer: Engineer = {
      zendesk_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    const { error } = await supabase
      .from('engineers')
      .upsert(engineer, { 
        onConflict: 'zendesk_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Failed to upsert engineer:', error);
      throw error;
    }
  }

  private async upsertTicketsBatch(tickets: any[]): Promise<void> {
    const ticketData: Ticket[] = tickets.map(ticket => ({
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
      tags: ticket.tags,
      custom_fields: ticket.custom_fields
    }));

    const { error } = await supabase
      .from('tickets')
      .upsert(ticketData, { 
        onConflict: 'zendesk_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Failed to upsert tickets batch:', error);
      throw error;
    }
  }

  private async calculateAndStoreMetrics(
    users: any[], 
    tickets: any[], 
    startDate?: Date, 
    endDate?: Date
  ): Promise<EngineerMetrics[]> {
    const engineerMetrics: EngineerMetrics[] = [];

    for (const user of users) {
      const metrics = calculateEngineerMetrics(user, tickets, startDate, endDate);
      engineerMetrics.push(metrics);

      // Store in database
      await this.storeEngineerMetrics(user.id, metrics, startDate, endDate);
    }

    return engineerMetrics;
  }

  private async storeEngineerMetrics(
    userId: number, 
    metrics: EngineerMetrics, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<void> {
    // First, get the engineer's database ID
    const { data: engineer } = await supabase
      .from('engineers')
      .select('id')
      .eq('zendesk_id', userId)
      .single();

    if (!engineer) {
      throw new Error(`Engineer with Zendesk ID ${userId} not found in database`);
    }

    const metricData: EngineerMetric = {
      engineer_id: engineer.id,
      ces_percent: metrics.cesPercent,
      avg_pcc: metrics.avgPcc,
      closed: metrics.closed,
      open: metrics.open,
      open_greater_than_14: metrics.openGreaterThan14,
      closed_less_than_7: metrics.closedLessThan7,
      closed_equal_1: metrics.closedEqual1,
      participation_rate: metrics.participationRate,
      link_count: metrics.linkCount,
      citation_count: metrics.citationCount,
      creation_count: metrics.creationCount,
      enterprise_percent: metrics.enterprisePercent,
      technical_percent: metrics.technicalPercent,
      survey_count: metrics.surveyCount,
      period_start: startDate?.toISOString() || null,
      period_end: endDate?.toISOString() || null,
      calculated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('engineer_metrics')
      .upsert(metricData, { 
        onConflict: 'engineer_id,calculated_at',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Failed to store engineer metrics:', error);
      throw error;
    }
  }
}

// Backend/CLI sync functions - these call Zendesk API and should not be used by frontend
export async function syncFullDataFromZendesk(
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
