-- Zendesk Dashboard Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security (RLS) for all tables
-- You can customize these policies based on your auth requirements

-- 1. Engineers table - stores Zendesk user data
CREATE TABLE engineers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zendesk_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tickets table - stores Zendesk ticket data
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zendesk_id BIGINT UNIQUE NOT NULL,
  subject TEXT,
  status VARCHAR(50) NOT NULL CHECK (status IN ('new', 'open', 'pending', 'hold', 'solved', 'closed')),
  priority VARCHAR(20) CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  type VARCHAR(20) CHECK (type IN ('problem', 'incident', 'question', 'task')),
  assignee_id BIGINT REFERENCES engineers(zendesk_id),
  requester_id BIGINT,
  submitter_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  solved_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[], -- Array of tags
  custom_fields JSONB, -- Store custom fields as JSON
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Engineer metrics table - stores calculated performance metrics
CREATE TABLE engineer_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID REFERENCES engineers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Core metrics from EngineerMetrics interface
  ces_percent DECIMAL(5,2) DEFAULT 0,
  avg_pcc DECIMAL(8,2) DEFAULT 0,
  closed INTEGER DEFAULT 0,
  open INTEGER DEFAULT 0,
  open_greater_than_14 INTEGER DEFAULT 0,
  closed_less_than_7 DECIMAL(5,2) DEFAULT 0,
  closed_equal_1 DECIMAL(5,2) DEFAULT 0,
  participation_rate DECIMAL(5,2) DEFAULT 0,
  link_count DECIMAL(5,2) DEFAULT 0,
  citation_count INTEGER DEFAULT 0,
  creation_count DECIMAL(5,2) DEFAULT 0,
  enterprise_percent DECIMAL(5,2) DEFAULT 0,
  technical_percent DECIMAL(5,2) DEFAULT 0,
  survey_count INTEGER DEFAULT 0,
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one metric record per engineer per period
  UNIQUE(engineer_id, period_start, period_end)
);

-- Create indexes for better query performance
CREATE INDEX idx_engineers_zendesk_id ON engineers(zendesk_id);
CREATE INDEX idx_engineers_name ON engineers(name);

CREATE INDEX idx_tickets_zendesk_id ON tickets(zendesk_id);
CREATE INDEX idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_updated_at ON tickets(updated_at);
CREATE INDEX idx_tickets_custom_fields ON tickets USING GIN(custom_fields);

CREATE INDEX idx_engineer_metrics_engineer_id ON engineer_metrics(engineer_id);
CREATE INDEX idx_engineer_metrics_period ON engineer_metrics(period_start, period_end);
CREATE INDEX idx_engineer_metrics_calculated_at ON engineer_metrics(calculated_at);

-- Add trigger to automatically update updated_at for engineers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_engineers_updated_at 
    BEFORE UPDATE ON engineers 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_metrics ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your auth requirements)
-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON engineers
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON tickets
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON engineer_metrics
    FOR ALL USING (auth.role() = 'authenticated');

-- Insert the target engineers from your current app
INSERT INTO engineers (zendesk_id, name, email, role, active) VALUES
(29215234714775, 'Jared Beckler', 'jared@builder.io', 'engineer', true),
(29092423638935, 'Rahul Joshi', 'rahul@builder.io', 'engineer', true),
(29092389569431, 'Parth Sharma', 'parth@builder.io', 'engineer', true),
(24100359866391, 'Fernando Duran', 'fernando@builder.io', 'engineer', true),
(19347232342679, 'Alex Bridgeman', 'alexander@builder.io', 'engineer', true),
(16211207272855, 'Sheema Parwaz', 'sheema@builder.io', 'engineer', true),
(5773445002519, 'Manish Sharma', 'manish@builder.io', 'engineer', true),
(26396676511767, 'Akash Singh', 'akash@builder.io', 'engineer', true)
ON CONFLICT (zendesk_id) DO NOTHING;

-- Create a view for easy metric querying
CREATE VIEW latest_engineer_metrics AS
SELECT 
    e.name,
    e.zendesk_id,
    em.*
FROM engineer_metrics em
JOIN engineers e ON em.engineer_id = e.id
WHERE em.calculated_at = (
    SELECT MAX(calculated_at) 
    FROM engineer_metrics em2 
    WHERE em2.engineer_id = em.engineer_id
);

COMMENT ON TABLE engineers IS 'Stores engineer/user data from Zendesk';
COMMENT ON TABLE tickets IS 'Stores support ticket data from Zendesk';
COMMENT ON TABLE engineer_metrics IS 'Stores calculated performance metrics for each engineer per time period';
COMMENT ON VIEW latest_engineer_metrics IS 'Shows the most recent metrics for each engineer';
