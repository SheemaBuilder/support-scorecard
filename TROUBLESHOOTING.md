# Troubleshooting Guide

## Row Level Security (RLS) Policy Errors

If you encounter errors like:
```
Failed to upsert engineer: new row violates row-level security policy for table "engineers"
```

This means the Supabase Row Level Security policies are preventing the anon key from accessing the database.

### Quick Fix (Recommended for Development)

1. Go to your Supabase dashboard → SQL Editor
2. Run the contents of `fix-rls-policies.sql`:

```sql
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON engineers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON tickets;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON engineer_metrics;

-- Create new policies that allow anon role
CREATE POLICY "Allow read/write for dashboard users" ON engineers
    FOR ALL USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Allow read/write for dashboard users" ON tickets
    FOR ALL USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Allow read/write for dashboard users" ON engineer_metrics
    FOR ALL USING (auth.role() IN ('anon', 'authenticated'));
```

### Alternative: Disable RLS (Development Only)

For development environments, you can disable RLS entirely:

1. Go to your Supabase dashboard → SQL Editor  
2. Run the contents of `disable-rls-for-dev.sql`:

```sql
ALTER TABLE engineers DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_metrics DISABLE ROW LEVEL SECURITY;
```

⚠️ **Warning**: Only use this for development. Re-enable RLS for production.

### Production Setup

For production, you should:
1. Set up proper Supabase authentication
2. Create specific RLS policies for your auth users
3. Use authenticated users instead of anon key

## Other Common Issues

### Missing Environment Variables
Ensure your `.env` file contains:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ZENDESK_SUBDOMAIN=your-zendesk-subdomain
VITE_ZENDESK_EMAIL=your-email@domain.com
VITE_ZENDESK_API_TOKEN=your-zendesk-api-token
```

### Sync Script Issues
If the command line sync script fails:
1. Check all environment variables are set
2. Ensure Supabase tables exist
3. Verify Zendesk API credentials work
