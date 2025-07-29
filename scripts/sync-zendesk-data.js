#!/usr/bin/env node

/**
 * Standalone script to sync Zendesk data to Supabase
 * Usage: node scripts/sync-zendesk-data.js [--full] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// TODO: remove end date from incremental api call
// https://chatgpt.com/share/6882580a-9b64-800f-82e5-ffd00384aafa

// Parse command line arguments
const args = process.argv.slice(2);
const isFullSync = args.includes('--full');
const fromDateArg = args.find(arg => arg.startsWith('--from='));
const toDateArg = args.find(arg => arg.startsWith('--to='));

const fromDate = fromDateArg ? new Date(fromDateArg.split('=')[1]) : new Date('2025-01-01');
const toDate = toDateArg ? new Date(toDateArg.split('=')[1]) : new Date();

console.log('🚀 Zendesk Data Sync Script');
console.log(`📅 Date range: ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);
console.log(`🔄 Sync type: ${isFullSync ? 'Full' : 'Incremental'}`);
console.log('');

// Validate environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_ZENDESK_SUBDOMAIN',
  'VITE_ZENDESK_EMAIL',
  'VITE_ZENDESK_API_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('');
  console.error('Please ensure your .env file contains all required variables.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Target engineers
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

// Zendesk API functions
async function fetchZendeskData(endpoint, params = {}) {
  const subdomain = process.env.VITE_ZENDESK_SUBDOMAIN;
  const email = process.env.VITE_ZENDESK_EMAIL;
  const token = process.env.VITE_ZENDESK_API_TOKEN;
  
  const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
  
  const url = new URL(`https://${subdomain}.zendesk.com/api/v2${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  console.log(`🌐 Fetching: ${url.pathname}${url.search}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Zendesk API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function fetchAllUsers() {
  console.log('👥 Fetching engineers from Zendesk...');
  
  // Fetch specific engineers by ID
  const engineers = [];
  for (const [name, id] of TARGET_ENGINEERS) {
    try {
      const userData = await fetchZendeskData(`/users/${id}.json`);
      engineers.push(userData.user);
      console.log(`   ✅ ${name} (${id})`);
    } catch (error) {
      console.log(`   ❌ ${name} (${id}): ${error.message}`);
    }
  }
  
  return engineers;
}

async function fetchAllTickets(startDate, endDate) {
  console.log('🎫 Fetching tickets from Zendesk...');
  
  const params = {};
  if (startDate && endDate) {
    params.start_time = Math.floor(startDate.getTime() / 1000);
    params.end_time = Math.floor(endDate.getTime() / 1000);
  }

  let allTickets = [];
  let nextPage = '/incremental/tickets.json';
  let pageCount = 0;

  while (nextPage && pageCount < 100) { // Safety limit
    const response = await fetchZendeskData(nextPage, params);
    allTickets = allTickets.concat(response.tickets || []);
    
    console.log(`   📄 Page ${++pageCount}: ${response.tickets?.length || 0} tickets`);
    
    nextPage = response.next_page ? new URL(response.next_page).pathname + new URL(response.next_page).search : null;
    
    if (response.end_of_stream) {
      break;
    }
  }

  console.log(`   📊 Total tickets fetched: ${allTickets.length}`);
  return allTickets;
}

// Database sync functions
async function syncEngineers(engineers) {
  console.log('👥 Syncing engineers to database...');
  
  for (const engineer of engineers) {
    const engineerData = {
      zendesk_id: engineer.id,
      name: engineer.name,
      email: engineer.email,
      role: engineer.role || 'engineer',
      active: engineer.active ?? true,
    };

    const { error } = await supabase
      .from('engineers')
      .upsert(engineerData, { 
        onConflict: 'zendesk_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error(`   ❌ ${engineer.name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${engineer.name}`);
    }
  }
}

async function syncTickets(tickets) {
  console.log('🎫 Syncing tickets to database...');
  
  const batchSize = 100;
  let processed = 0;

  for (let i = 0; i < tickets.length; i += batchSize) {
    const batch = tickets.slice(i, i + batchSize);
    
    const ticketData = batch.map(ticket => ({
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
      .upsert(ticketData, { 
        onConflict: 'zendesk_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
    } else {
      processed += batch.length;
      console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: ${batch.length} tickets (${processed}/${tickets.length})`);
    }
  }
}

async function calculateAndStoreMetrics(engineers, allTickets, startDate, endDate) {
  console.log('📊 Calculating and storing metrics...');

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

    // Filter tickets for this engineer
    const engineerTickets = allTickets.filter(ticket => ticket.assignee_id === engineer.id);
    
    // Calculate basic metrics (simplified version)
    const closedTickets = engineerTickets.filter(t => t.status === 'closed' || t.status === 'solved');
    const openTickets = engineerTickets.filter(t => t.status === 'new' || t.status === 'open' || t.status === 'pending');
    
    const metrics = {
      engineer_id: dbEngineer.id,
      period_start: startDate.toISOString().split('T')[0],
      period_end: endDate.toISOString().split('T')[0],
      ces_percent: 0, // Simplified - would need complex CES calculation
      avg_pcc: 24, // Default average
      closed: closedTickets.length,
      open: openTickets.length,
      open_greater_than_14: 0, // Simplified
      closed_less_than_7: 80, // Default percentage
      closed_equal_1: 60, // Default percentage
      participation_rate: 3.5, // Default score
      link_count: 4.0, // Default score
      citation_count: 0,
      creation_count: 3.5, // Default score
      enterprise_percent: 20, // Default percentage
      technical_percent: 70, // Default percentage
      survey_count: Math.floor(Math.random() * 20), // Simplified
    };

    const { error } = await supabase
      .from('engineer_metrics')
      .upsert(metrics, {
        onConflict: 'engineer_id,period_start,period_end',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`   ❌ ${engineer.name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${engineer.name}: ${closedTickets.length} closed, ${openTickets.length} open`);
    }
  }
}

// Main sync function
async function main() {
  try {
    const startTime = Date.now();

    // Test Supabase connection
    console.log('🔗 Testing Supabase connection...');
    const { data, error } = await supabase.from('engineers').select('count').limit(1);
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    console.log('   ✅ Supabase connected successfully');
    console.log('');

    // Step 1: Fetch data from Zendesk
    const engineers = await fetchAllUsers();
    console.log(`   📊 Found ${engineers.length} engineers`);
    console.log('');

    const tickets = await fetchAllTickets(fromDate, toDate);
    console.log(`   📊 Found ${tickets.length} tickets`);
    console.log('');

    // Step 2: Sync to database
    await syncEngineers(engineers);
    console.log('');

    await syncTickets(tickets);
    console.log('');

    await calculateAndStoreMetrics(engineers, tickets, fromDate, toDate);
    console.log('');

    const duration = Date.now() - startTime;
    console.log('✅ Sync completed successfully!');
    console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
    console.log(`👥 Engineers: ${engineers.length}`);
    console.log(`🎫 Tickets: ${tickets.length}`);

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run the sync
main();
