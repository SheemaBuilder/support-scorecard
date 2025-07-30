-- Supabase Database Cleanup Script
-- This script removes UUIDs and simplifies the schema to use Zendesk IDs directly

-- WARNING: This will delete all existing data. Make sure to backup if needed.

-- Step 1: Drop existing tables to start fresh
DROP TABLE IF EXISTS engineer_metrics CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS engineers CASCADE;

-- Step 2: Create simplified engineers table using zendesk_id as primary key
CREATE TABLE engineers (
    zendesk_id BIGINT PRIMARY KEY,  -- Use Zendesk ID directly as primary key
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create simplified tickets table using zendesk_id as primary key
CREATE TABLE tickets (
    zendesk_id BIGINT PRIMARY KEY,  -- Use Zendesk ID directly as primary key
    subject TEXT,
    status TEXT NOT NULL CHECK (status IN ('new', 'open', 'pending', 'hold', 'solved', 'closed')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    type TEXT CHECK (type IN ('problem', 'incident', 'question', 'task')),
    assignee_id BIGINT,  -- References engineer zendesk_id directly
    requester_id BIGINT NOT NULL,
    submitter_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    solved_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key constraint to engineers table
    CONSTRAINT fk_assignee_engineer 
        FOREIGN KEY (assignee_id) 
        REFERENCES engineers(zendesk_id) 
        ON DELETE SET NULL
);

-- Step 4: Create simplified engineer_metrics table referencing engineers directly
CREATE TABLE engineer_metrics (
    engineer_zendesk_id BIGINT NOT NULL,  -- Direct reference to engineer zendesk_id
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    ces_percent NUMERIC(5,2) DEFAULT 0,
    avg_pcc NUMERIC(10,2) DEFAULT 0,
    closed INTEGER DEFAULT 0,
    open INTEGER DEFAULT 0,
    open_greater_than_14 INTEGER DEFAULT 0,
    closed_less_than_7 NUMERIC(5,2) DEFAULT 0,
    closed_equal_1 NUMERIC(5,2) DEFAULT 0,
    participation_rate NUMERIC(5,2) DEFAULT 0,
    link_count NUMERIC(5,2) DEFAULT 0,
    citation_count NUMERIC(5,2) DEFAULT 0,
    creation_count NUMERIC(5,2) DEFAULT 0,
    enterprise_percent NUMERIC(5,2) DEFAULT 0,
    technical_percent NUMERIC(5,2) DEFAULT 0,
    survey_count INTEGER DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Primary key is combination of engineer and calculation time
    PRIMARY KEY (engineer_zendesk_id, calculated_at),
    
    -- Foreign key constraint to engineers table
    CONSTRAINT fk_metrics_engineer 
        FOREIGN KEY (engineer_zendesk_id) 
        REFERENCES engineers(zendesk_id) 
        ON DELETE CASCADE
);

-- Step 5: Create indexes for better performance
CREATE INDEX idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_engineer_metrics_calculated_at ON engineer_metrics(calculated_at);

-- Step 6: Enable Row Level Security (RLS) if needed
ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_metrics ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access on engineers" ON engineers FOR SELECT USING (true);
CREATE POLICY "Allow public read access on tickets" ON tickets FOR SELECT USING (true);  
CREATE POLICY "Allow public read access on engineer_metrics" ON engineer_metrics FOR SELECT USING (true);

-- Allow authenticated users to insert/update data (for sync scripts)
CREATE POLICY "Allow authenticated insert on engineers" ON engineers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on engineers" ON engineers FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated insert on tickets" ON tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on tickets" ON tickets FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated insert on engineer_metrics" ON engineer_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on engineer_metrics" ON engineer_metrics FOR UPDATE USING (true);

-- Step 8: Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Add triggers to automatically update updated_at columns
CREATE TRIGGER trigger_engineers_updated_at
    BEFORE UPDATE ON engineers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Success message
SELECT 'Supabase database schema cleaned up successfully! UUIDs removed, now using Zendesk IDs directly.' AS status;

/*
SUMMARY OF CHANGES:
- Removed all UUID primary keys from engineers and tickets tables
- Use zendesk_id as the primary key for engineers and tickets
- engineer_metrics table now references engineers directly via engineer_zendesk_id
- Simplified foreign key relationships
- No more need to lookup UUIDs when storing metrics
- Much simpler and more efficient queries

NEXT STEPS:
1. Run this SQL script in your Supabase SQL editor
2. Run the sync script to populate the new tables: npm run sync:incremental
3. The frontend will now work without UUID complexity
*/
