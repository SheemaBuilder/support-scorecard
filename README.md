# Zendesk Performance Dashboard

A modern React dashboard for tracking Zendesk support engineer performance metrics, powered by Supabase for fast data access.

## Features

- 📊 **Real-time Metrics**: Engineer performance tracking with CES scores, ticket counts, and response times
- ⚡ **Fast Loading**: Data served from Supabase for instant dashboard loading
- 🔄 **Data Sync**: Pull latest data from Zendesk with progress tracking
- 📈 **Visualizations**: Interactive charts and performance comparisons
- 🚨 **Alerts**: Automated alerts for performance issues

## Architecture

```
Zendesk API → Data Sync → Supabase Database → React Dashboard
```

- **Frontend**: React + TypeScript + TailwindCSS + Vite
- **Database**: Supabase (PostgreSQL)
- **Data Source**: Zendesk API
- **Styling**: TailwindCSS with shadcn/ui components

## Quick Start

### 1. Setup Supabase

1. Create a [Supabase](https://supabase.com) project
2. Run the SQL from `database-schema.sql` in your Supabase SQL Editor
3. Fix RLS policies by running `fix-rls-policies.sql`

### 2. Configure Environment

Create `.env` file:
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Zendesk API Configuration (for data sync)
VITE_ZENDESK_SUBDOMAIN=your-zendesk-subdomain
VITE_ZENDESK_EMAIL=your-email@domain.com
VITE_ZENDESK_API_TOKEN=your-zendesk-api-token
```

### 3. Initial Data Sync

```bash
# Install dependencies
npm install

# Sync 2025 data from Zendesk
npm run sync:2025

# Start the dashboard
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run sync:2025` - Sync all 2025 data from Zendesk
- `npm run sync:full` - Sync all historical data
- `npm run sync:incremental` - Sync only new/changed data

## Usage

### Dashboard Access
1. Start the dev server: `npm run dev`
2. Open http://localhost:5173
3. View engineer metrics, charts, and performance data

### Data Sync
- **Manual**: Click "Pull Data" button in dashboard
- **Script**: Run `npm run sync:incremental` 
- **Automated**: Set up cron job for regular syncs

## Data Model

### Engineers Table
Stores Zendesk user information for tracked engineers

### Tickets Table  
Stores all support tickets with custom fields and tags

### Engineer Metrics Table
Pre-calculated performance metrics per engineer per time period

## Monitoring Metrics

- **CES (Customer Effort Score)**: Customer satisfaction percentage
- **Ticket Volume**: Closed/open ticket counts
- **Response Times**: Average time to first response
- **Quality Scores**: Technical accuracy and communication
- **SLA Performance**: Closure time statistics

## Development

### Tech Stack
- React 18 + TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Supabase for database
- Recharts for visualizations

### Project Structure
```
src/
├── components/         # Reusable UI components
├── hooks/             # React hooks
├── lib/               # Utilities and services
├── pages/             # Page components
└── types/             # TypeScript types
```

## Deployment

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting provider
3. Ensure environment variables are set in production
4. Set up automated data sync

## Troubleshooting

See `TROUBLESHOOTING.md` for common issues and solutions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
