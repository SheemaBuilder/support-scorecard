-- Monthly Tables Setup Script (Fixed Version)
-- Creates separate engineer_metrics tables for each month of 2025

-- Function to create a monthly metrics table
CREATE OR REPLACE FUNCTION create_monthly_metrics_table(month_name TEXT, year_int INTEGER) 
RETURNS TEXT AS $$
DECLARE
    monthly_table_name TEXT := 'engineer_metrics_' || lower(month_name) || '_' || year_int::TEXT;
BEGIN
    -- Create the monthly table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
            engineer_zendesk_id BIGINT NOT NULL,
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
            
            -- Primary key is engineer for monthly tables (one record per engineer per month)
            PRIMARY KEY (engineer_zendesk_id),
            
            -- Foreign key constraint to engineers table
            CONSTRAINT %I FOREIGN KEY (engineer_zendesk_id) 
                REFERENCES engineers(zendesk_id) 
                ON DELETE CASCADE
        )', monthly_table_name, 'fk_' || monthly_table_name || '_engineer');

    -- Create index for better performance
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(calculated_at)', 
                   'idx_' || monthly_table_name || '_calculated_at', monthly_table_name);

    -- Enable Row Level Security
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', monthly_table_name);
    
    -- Create policies for public access
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'allow_public_read_' || monthly_table_name, monthly_table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', 
                   'allow_public_read_' || monthly_table_name, monthly_table_name);
                   
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'allow_auth_insert_' || monthly_table_name, monthly_table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (true)', 
                   'allow_auth_insert_' || monthly_table_name, monthly_table_name);
                   
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'allow_auth_update_' || monthly_table_name, monthly_table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (true)', 
                   'allow_auth_update_' || monthly_table_name, monthly_table_name);

    RETURN 'Created table: ' || monthly_table_name;
END;
$$ LANGUAGE plpgsql;

-- Create tables for all months of 2025
SELECT create_monthly_metrics_table('january', 2025);
SELECT create_monthly_metrics_table('february', 2025);
SELECT create_monthly_metrics_table('march', 2025);
SELECT create_monthly_metrics_table('april', 2025);
SELECT create_monthly_metrics_table('may', 2025);
SELECT create_monthly_metrics_table('june', 2025);
SELECT create_monthly_metrics_table('july', 2025);
SELECT create_monthly_metrics_table('august', 2025);
SELECT create_monthly_metrics_table('september', 2025);
SELECT create_monthly_metrics_table('october', 2025);
SELECT create_monthly_metrics_table('november', 2025);
SELECT create_monthly_metrics_table('december', 2025);

-- Data migration block (separated to avoid variable conflicts)
DO $$
DECLARE
    source_table_exists boolean := false;
    has_new_schema boolean := false;
    rec RECORD;
    month_name TEXT;
    target_table TEXT;
BEGIN
    -- Check if source table exists
    SELECT COUNT(*) > 0 INTO source_table_exists
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'engineer_metrics';
    
    IF source_table_exists THEN
        RAISE NOTICE 'Found engineer_metrics table, proceeding with data migration...';
        
        -- Check schema type
        SELECT COUNT(*) > 0 INTO has_new_schema
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'engineer_metrics' 
          AND column_name = 'engineer_zendesk_id';
        
        IF has_new_schema THEN
            RAISE NOTICE 'Using new schema (engineer_zendesk_id)';
        ELSE
            RAISE NOTICE 'Using old schema (engineer_id)';
        END IF;
        
        -- Migrate data from engineer_metrics to monthly tables
        FOR rec IN 
            SELECT *, 
                   EXTRACT(MONTH FROM calculated_at) as month_num,
                   EXTRACT(YEAR FROM calculated_at) as year_num
            FROM engineer_metrics 
            WHERE EXTRACT(YEAR FROM calculated_at) = 2025
        LOOP
            -- Convert month number to month name
            month_name := CASE rec.month_num
                WHEN 1 THEN 'january'
                WHEN 2 THEN 'february'
                WHEN 3 THEN 'march'
                WHEN 4 THEN 'april'
                WHEN 5 THEN 'may'
                WHEN 6 THEN 'june'
                WHEN 7 THEN 'july'
                WHEN 8 THEN 'august'
                WHEN 9 THEN 'september'
                WHEN 10 THEN 'october'
                WHEN 11 THEN 'november'
                WHEN 12 THEN 'december'
            END;
            
            target_table := 'engineer_metrics_' || month_name || '_2025';
            
            -- Insert into the appropriate monthly table
            BEGIN
                IF has_new_schema THEN
                    -- New schema: engineer_zendesk_id
                    EXECUTE format('INSERT INTO %I (
                        engineer_zendesk_id, period_start, period_end, ces_percent, avg_pcc,
                        closed, open, open_greater_than_14, closed_less_than_7, closed_equal_1,
                        participation_rate, link_count, citation_count, creation_count,
                        enterprise_percent, technical_percent, survey_count, calculated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                    ON CONFLICT (engineer_zendesk_id) DO UPDATE SET
                        period_start = EXCLUDED.period_start,
                        period_end = EXCLUDED.period_end,
                        ces_percent = EXCLUDED.ces_percent,
                        avg_pcc = EXCLUDED.avg_pcc,
                        closed = EXCLUDED.closed,
                        open = EXCLUDED.open,
                        open_greater_than_14 = EXCLUDED.open_greater_than_14,
                        closed_less_than_7 = EXCLUDED.closed_less_than_7,
                        closed_equal_1 = EXCLUDED.closed_equal_1,
                        participation_rate = EXCLUDED.participation_rate,
                        link_count = EXCLUDED.link_count,
                        citation_count = EXCLUDED.citation_count,
                        creation_count = EXCLUDED.creation_count,
                        enterprise_percent = EXCLUDED.enterprise_percent,
                        technical_percent = EXCLUDED.technical_percent,
                        survey_count = EXCLUDED.survey_count,
                        calculated_at = EXCLUDED.calculated_at',
                        target_table) 
                    USING rec.engineer_zendesk_id, rec.period_start, rec.period_end, rec.ces_percent, rec.avg_pcc,
                          rec.closed, rec.open, rec.open_greater_than_14, rec.closed_less_than_7, rec.closed_equal_1,
                          rec.participation_rate, rec.link_count, rec.citation_count, rec.creation_count,
                          rec.enterprise_percent, rec.technical_percent, rec.survey_count, rec.calculated_at;
                ELSE
                    -- Old schema: engineer_id (UUID) - need to lookup zendesk_id
                    EXECUTE format('INSERT INTO %I (
                        engineer_zendesk_id, period_start, period_end, ces_percent, avg_pcc,
                        closed, open, open_greater_than_14, closed_less_than_7, closed_equal_1,
                        participation_rate, link_count, citation_count, creation_count,
                        enterprise_percent, technical_percent, survey_count, calculated_at
                    ) 
                    SELECT e.zendesk_id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                    FROM engineers e WHERE e.id = $1
                    ON CONFLICT (engineer_zendesk_id) DO UPDATE SET
                        period_start = EXCLUDED.period_start,
                        period_end = EXCLUDED.period_end,
                        ces_percent = EXCLUDED.ces_percent,
                        avg_pcc = EXCLUDED.avg_pcc,
                        closed = EXCLUDED.closed,
                        open = EXCLUDED.open,
                        open_greater_than_14 = EXCLUDED.open_greater_than_14,
                        closed_less_than_7 = EXCLUDED.closed_less_than_7,
                        closed_equal_1 = EXCLUDED.closed_equal_1,
                        participation_rate = EXCLUDED.participation_rate,
                        link_count = EXCLUDED.link_count,
                        citation_count = EXCLUDED.citation_count,
                        creation_count = EXCLUDED.creation_count,
                        enterprise_percent = EXCLUDED.enterprise_percent,
                        technical_percent = EXCLUDED.technical_percent,
                        survey_count = EXCLUDED.survey_count,
                        calculated_at = EXCLUDED.calculated_at',
                        target_table) 
                    USING rec.engineer_id, rec.period_start, rec.period_end, rec.ces_percent, rec.avg_pcc,
                          rec.closed, rec.open, rec.open_greater_than_14, rec.closed_less_than_7, rec.closed_equal_1,
                          rec.participation_rate, rec.link_count, rec.citation_count, rec.creation_count,
                          rec.enterprise_percent, rec.technical_percent, rec.survey_count, rec.calculated_at;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Log error but continue
                RAISE NOTICE 'Error migrating record to %: %', target_table, SQLERRM;
            END;
        END LOOP;
        
        RAISE NOTICE 'Data migration completed. Check the monthly tables for migrated data.';
    ELSE
        RAISE NOTICE 'No engineer_metrics table found. Monthly tables created without data migration.';
    END IF;
END $$;

-- Clean up the function
DROP FUNCTION create_monthly_metrics_table(TEXT, INTEGER);

-- Success message
SELECT 'Monthly tables created successfully! Tables: engineer_metrics_january_2025 through engineer_metrics_december_2025' AS status;

/*
SUMMARY:
- Fixed variable naming conflicts that caused ambiguous column reference errors
- Created 12 monthly tables for 2025: engineer_metrics_january_2025, engineer_metrics_february_2025, etc.
- Each table has the same structure as the original engineer_metrics table
- Primary key is engineer_zendesk_id (one record per engineer per month)
- Includes foreign key constraints, indexes, and RLS policies
- Automatically migrated existing data to appropriate monthly tables based on calculated_at dates
- Compatible with both old (UUID) and new (zendesk_id) schemas

NEXT STEPS:
1. Run this fixed SQL script in Supabase
2. Update sync scripts to target specific monthly tables
3. Frontend will now query the appropriate monthly table based on date selection
*/
