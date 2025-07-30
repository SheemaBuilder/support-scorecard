#!/usr/bin/env node

/**
 * Standalone script to sync Zendesk data to Supabase
 * Default: Syncs last 30 days of data
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

// Default to last 30 days if no dates specified
const defaultFromDate = new Date();
defaultFromDate.setDate(defaultFromDate.getDate() - 30);

const fromDate = fromDateArg ? new Date(fromDateArg.split('=')[1]) : defaultFromDate;
const toDate = toDateArg ? new Date(toDateArg.split('=')[1]) : new Date();

console.log('🚀 Zendesk Data Sync Script');
console.log(`📅 Date range: ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);
console.log(`🔄 Sync type: ${isFullSync ? 'Full' : fromDateArg ? 'Custom Range' : 'Last 30 Days (Default)'}`);
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
  console.log('🎫 Fetching solved and closed tickets from Zendesk...');
  
  let allTickets = [];
  
  // Get target engineer IDs for filtering
  const targetEngineerIds = Array.from(TARGET_ENGINEERS.values());
  
  // Fetch solved tickets
  console.log('   🔍 Fetching solved tickets...');
  const solvedTickets = await fetchTicketsByStatus('solved', startDate, endDate);
  allTickets = allTickets.concat(solvedTickets);
  
  // Fetch closed tickets
  console.log('   🔍 Fetching closed tickets...');
  const closedTickets = await fetchTicketsByStatus('closed', startDate, endDate);
  allTickets = allTickets.concat(closedTickets);
  
  // Filter tickets to only include those assigned to target engineers
  const filteredTickets = allTickets.filter(ticket => 
    ticket.assignee_id && targetEngineerIds.includes(ticket.assignee_id)
  );
  
  console.log(`   📊 Total solved/closed tickets fetched: ${allTickets.length}`);
  console.log(`   🎯 Tickets assigned to target engineers: ${filteredTickets.length}`);
  return filteredTickets;
}

async function fetchTicketsByStatus(status, startDate, endDate) {
  let allTickets = [];
  let page = 1;
  const perPage = 100;
  
  // Build search query with date range if provided
  let searchQuery = `status:${status}`;
  if (startDate && endDate) {
    // Format dates as YYYY-MM-DD for Zendesk search
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    searchQuery += ` created:${startDateStr}..${endDateStr}`;
  }
  
  console.log(`      Query: ${searchQuery}`);
  
  while (page <= 10) { // Safety limit of 10 pages
    const params = {
      query: searchQuery,
      page: page,
      per_page: perPage,
      sort_by: 'created_at',
      sort_order: 'desc'
    };
    
    try {
      const response = await fetchZendeskData('/search.json', params);
      const tickets = response.results || [];
      
      if (tickets.length === 0) {
        break; // No more results
      }
      
      allTickets = allTickets.concat(tickets);
      console.log(`      📄 Page ${page}: ${tickets.length} ${status} tickets`);
      
      page++;
    } catch (error) {
      console.error(`      ❌ Error fetching ${status} tickets on page ${page}:`, error.message);
      // Try without date range if it fails
      if (startDate && endDate) {
        console.log(`      🔄 Retrying without date range...`);
        return await fetchTicketsByStatus(status, null, null);
      }
      throw error;
    }
  }
  
  console.log(`      ✅ Total ${status} tickets: ${allTickets.length}`);
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

async function createMonthlyTableIfNotExists(tableName) {
  console.log(`🔨 Checking if table exists: ${tableName}`);
  
  // Try to query the table to see if it exists
  const { data, error } = await supabase
    .from(tableName)
    .select('count')
    .limit(1);
  
  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('relation') || error.code === '42P01') {
      console.log(`   📋 Table ${tableName} does not exist - you need to create it manually in Supabase SQL Editor`);
      console.log(`   📋 Run this SQL in your Supabase SQL Editor:`);
      console.log(`   📋 CREATE TABLE ${tableName} (`);
      console.log(`   📋   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,`);
      console.log(`   📋   engineer_zendesk_id BIGINT NOT NULL,`);
      console.log(`   📋   period_start DATE NOT NULL,`);
      console.log(`   📋   period_end DATE NOT NULL,`);
      console.log(`   📋   ces_percent DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   avg_pcc DECIMAL(8,2) DEFAULT 0,`);
      console.log(`   📋   closed INTEGER DEFAULT 0,`);
      console.log(`   📋   open INTEGER DEFAULT 0,`);
      console.log(`   📋   open_greater_than_14 INTEGER DEFAULT 0,`);
      console.log(`   📋   closed_less_than_7 DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   closed_equal_1 DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   participation_rate DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   link_count DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   citation_count INTEGER DEFAULT 0,`);
      console.log(`   📋   creation_count DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   enterprise_percent DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   technical_percent DECIMAL(5,2) DEFAULT 0,`);
      console.log(`   📋   survey_count INTEGER DEFAULT 0,`);
      console.log(`   📋   calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),`);
      console.log(`   📋   UNIQUE(engineer_zendesk_id)`);
      console.log(`   📋 );`);
      throw new Error(`Table ${tableName} does not exist. Please create it manually in Supabase SQL Editor.`);
    } else {
      console.error(`   ❌ Error checking table ${tableName}:`, error.message);
      throw error;
    }
  } else {
    console.log(`   ✅ Table ${tableName} exists and is accessible`);
  }
}

async function calculateAndStoreMetrics(engineers, allTickets, startDate, endDate) {
  console.log('📊 Calculating and storing metrics...');

  // Determine which monthly table to use
  const year = endDate.getFullYear();
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const monthName = monthNames[endDate.getMonth()];
  const tableName = `engineer_metrics_${monthName}_${year}`;
  
  // Create the monthly table if it doesn't exist
  await createMonthlyTableIfNotExists(tableName);
  console.log('');

  // No need to lookup database IDs - use Zendesk IDs directly
  for (const engineer of engineers) {

    // Filter tickets for this engineer (all tickets are already solved/closed)
    const engineerTickets = allTickets.filter(ticket => ticket.assignee_id === engineer.id);

    // For monthly tables, filter tickets to only include those closed in the target month
    const targetYear = endDate.getFullYear();
    const targetMonth = endDate.getMonth();

    const monthlyClosedTickets = engineerTickets.filter(ticket => {
      if (!ticket.solved_at && !ticket.updated_at) return false;

      // Use solved_at if available, otherwise use updated_at as fallback
      const resolvedDate = new Date(ticket.solved_at || ticket.updated_at);
      const resolvedYear = resolvedDate.getFullYear();
      const resolvedMonth = resolvedDate.getMonth();

      // Only include tickets that were resolved in the target month/year
      return resolvedYear === targetYear && resolvedMonth === targetMonth;
    });

    console.log(`   📊 ${engineer.name}: ${engineerTickets.length} total assigned tickets, ${monthlyClosedTickets.length} closed in target month`);

    // Calculate basic metrics (using monthly filtered tickets)
    const closedTickets = monthlyClosedTickets;
    const openTickets = []; // No open tickets since we only fetch solved/closed
    
    // Calculate CES score from custom fields (using monthly filtered tickets)
    const cesScores = [];
    let ticketsWithCesScore = 0;

    for (const ticket of monthlyClosedTickets) {
      if (ticket.custom_fields && Array.isArray(ticket.custom_fields)) {
        const cesField = ticket.custom_fields.find(field => field.id === 31797439524887);
        if (cesField && cesField.value !== null && cesField.value !== undefined) {
          const score = parseFloat(cesField.value);
          if (!isNaN(score)) {
            cesScores.push(score);
            ticketsWithCesScore++;
          }
        }
      }
    }
    
    // Calculate average CES score
    const cesPercent = cesScores.length > 0 
      ? (cesScores.reduce((sum, score) => sum + score, 0) / cesScores.length)
      : 0;
    
         console.log(`   📊 ${engineer.name}: ${ticketsWithCesScore}/${engineerTickets.length} tickets have CES scores, avg: ${cesPercent.toFixed(2)}`);
     console.log(`   📊 Storing ${engineer.name} metrics in table: ${tableName}`);

    const metrics = {
      engineer_zendesk_id: engineer.id, // Use Zendesk ID directly instead of UUID
      period_start: startDate.toISOString().split('T')[0],
      period_end: endDate.toISOString().split('T')[0],
      ces_percent: Math.round(cesPercent * 100) / 100, // Round to 2 decimal places
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
      survey_count: ticketsWithCesScore, // Use actual count of tickets with CES scores
    };

    const { error } = await supabase
      .from(tableName)
      .upsert(metrics, {
        onConflict: 'engineer_zendesk_id', // Monthly tables have one record per engineer
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`   ❌ ${engineer.name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${engineer.name}: ${closedTickets.length} solved/closed tickets`);
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
