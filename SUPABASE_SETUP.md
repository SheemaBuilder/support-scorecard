# Supabase Integration Setup

This guide explains how to set up the Zendesk Performance Dashboard with Supabase as the data backend.

## Overview

The application now uses Supabase to store and manage Zendesk data, providing:
- **Fast dashboard loading** from cached data
- **Incremental data syncing** from Zendesk
- **Historical metrics tracking** over time
- **Reduced API calls** to Zendesk

## Architecture

```
Zendesk API → Sync Script → Supabase Database → Frontend Dashboard
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from the Settings → API page

### 2. Setup Database Schema

1. Go to your Supabase dashboard → SQL Editor
2. Copy the contents of `database-schema.sql` 
3. Paste and run the SQL to create all tables

### 3. Configure Environment Variables

Create a `.env` file with:

```bash
# Zendesk API Configuration (for data sync)
VITE_ZENDESK_SUBDOMAIN=your-zendesk-subdomain
VITE_ZENDESK_EMAIL=your-email@domain.com  
VITE_ZENDESK_API_TOKEN=your-zendesk-api-token

# Supabase Configuration (for data storage)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Initial Data Sync

Run the sync script to populate your database with 2025 data:

```bash
# Sync all data from 2025
npm run sync:2025

# Or sync full historical data
npm run sync:full

# Or sync incremental updates
npm run sync:incremental
```

### 5. Start the Application

```bash
npm run dev
```

The dashboard will now load data from Supabase instantly!

## Data Sync Options

### Frontend Sync (Manual)
- Click the "Pull Data" button in the dashboard
- Syncs latest data from Zendesk
- Shows real-time progress

### Script Sync (Automated)
```bash
# Sync all data from 2025
npm run sync:2025

# Sync data from specific date range
node scripts/sync-zendesk-data.js --from=2025-01-01 --to=2025-01-31

# Full historical sync
npm run sync:full
```

### Scheduled Sync (Recommended)
Set up a cron job or GitHub Action to run:
```bash
npm run sync:incremental
```

## Database Tables

### `engineers`
Stores engineer/user information from Zendesk

### `tickets` 
Stores all ticket data with custom fields and tags

### `engineer_metrics`
Stores calculated performance metrics per engineer per time period

## How It Works

1. **Data Sync**: Script fetches data from Zendesk API and stores in Supabase
2. **Metric Calculation**: Performance metrics are calculated and cached
3. **Dashboard Loading**: Frontend loads pre-calculated data instantly
4. **Incremental Updates**: Only new/changed data is synced

## Benefits

- ⚡ **Fast Loading**: Dashboard loads in milliseconds
- 📊 **Historical Data**: Track performance over time
- 🔄 **Incremental Sync**: Only sync what's changed
- 💰 **Cost Effective**: Reduced Zendesk API usage
- 🛡️ **Reliable**: Works even when Zendesk API is slow

## Troubleshooting

### Sync Fails
- Check environment variables are set correctly
- Verify Zendesk API credentials
- Check Supabase connection

### No Data in Dashboard
- Run initial sync: `npm run sync:2025`
- Check Supabase tables have data
- Verify date range settings

### Slow Performance
- Check database indexes are created
- Run `ANALYZE` on large tables
- Consider adding more specific indexes

## Monitoring

Monitor your sync performance:
- Check Supabase dashboard for table sizes
- Monitor sync script logs
- Set up alerts for failed syncs
