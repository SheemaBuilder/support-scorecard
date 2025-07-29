-- Fix RLS policies to allow anon role for dashboard operations
-- Run this in your Supabase SQL Editor

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON engineers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON tickets;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON engineer_metrics;

-- Create new policies that allow anon role (for dashboard access)
-- Engineers table - allow read/write for anon and authenticated users
CREATE POLICY "Allow read/write for dashboard users" ON engineers
    FOR ALL USING (auth.role() IN ('anon', 'authenticated'));

-- Tickets table - allow read/write for anon and authenticated users  
CREATE POLICY "Allow read/write for dashboard users" ON tickets
    FOR ALL USING (auth.role() IN ('anon', 'authenticated'));

-- Engineer metrics table - allow read/write for anon and authenticated users
CREATE POLICY "Allow read/write for dashboard users" ON engineer_metrics
    FOR ALL USING (auth.role() IN ('anon', 'authenticated'));

-- Verify policies are applied
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('engineers', 'tickets', 'engineer_metrics');
