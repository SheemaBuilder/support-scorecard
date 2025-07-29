-- July 2025 Performance Metrics Data
-- QA = Quality Assurance Score, CM = Customer Management Score  
-- RS = Response Score, TC = Team Collaboration Score

-- First, ensure engineers exist in the engineers table
-- Insert engineers if they don't exist (using ON CONFLICT to avoid duplicates)
INSERT INTO engineers (name, email, role, active, zendesk_id) VALUES
('Akash Singh', 'akash@builder.io', 'Support Engineer', true, 1001),
('Jared Beckler', 'jared@builder.io', 'Support Engineer', true, 1002),
('Parth Sharma', 'parth@builder.io', 'Support Engineer', true, 1003),
('Rahul Joshi', 'rahul@builder.io', 'Support Engineer', true, 1004),
('Fernando Duran', 'fernando@builder.io', 'Support Engineer', true, 1005),
('Alex Bridgeman', 'alexander@builder.io', 'Support Engineer', true, 1006),
('Sheema Parwaz', 'sheema@builder.io', 'Support Engineer', true, 1007),
('Manish Sharma', 'manish@builder.io', 'Support Engineer', true, 1008)
ON CONFLICT (name) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Insert July 2025 performance metrics
-- Using the performance scores as percentages (multiplied by 10 to convert to 0-100 scale)
INSERT INTO engineer_metrics (
  engineer_id,
  period_start,
  period_end,
  ces_percent,
  avg_pcc,
  closed,
  open,
  open_greater_than_14,
  closed_less_than_7,
  closed_equal_1,
  participation_rate,
  link_count,
  citation_count,
  creation_count,
  enterprise_percent,
  technical_percent,
  survey_count,
  calculated_at
) VALUES
-- Akash Singh (QA: 7.9, CM: 8.2, RS: 8.0, TC: 7.6)
((SELECT id FROM engineers WHERE name = 'Akash Singh'), 
 '2025-07-01'::date, '2025-07-31'::date,
 79.0, 8.2, 50, 12, 2, 40, 25, 8.0, 7.9, 8.2, 8.0, 7.6, 75.0, 20, NOW()),

-- Jared Beckler (QA: 8.2, CM: 8.2, RS: 8.2, TC: 8.2)  
((SELECT id FROM engineers WHERE name = 'Jared Beckler'),
 '2025-07-01'::date, '2025-07-31'::date,
 82.0, 8.2, 55, 10, 1, 45, 30, 8.2, 8.2, 8.2, 8.2, 8.2, 78.0, 22, NOW()),

-- Parth Sharma (QA: 8.1, CM: 8.4, RS: 7.9, TC: 8.1)
((SELECT id FROM engineers WHERE name = 'Parth Sharma'),
 '2025-07-01'::date, '2025-07-31'::date,
 81.0, 8.4, 52, 11, 2, 42, 28, 7.9, 8.1, 8.4, 7.9, 8.1, 76.0, 21, NOW()),

-- Rahul Joshi (QA: 8.1, CM: 8.5, RS: 7.8, TC: 8.1)
((SELECT id FROM engineers WHERE name = 'Rahul Joshi'),
 '2025-07-01'::date, '2025-07-31'::date,
 81.0, 8.5, 48, 14, 3, 38, 22, 7.8, 8.1, 8.5, 7.8, 8.1, 74.0, 19, NOW()),

-- Fernando Duran (QA: 8.1, CM: 8.3, RS: 8.0, TC: 8.0)
((SELECT id FROM engineers WHERE name = 'Fernando Duran'),
 '2025-07-01'::date, '2025-07-31'::date,
 81.0, 8.3, 51, 13, 2, 41, 26, 8.0, 8.1, 8.3, 8.0, 8.0, 77.0, 20, NOW()),

-- Alex Bridgeman (QA: 8.9, CM: 8.8, RS: 8.8, TC: 9.2)
((SELECT id FROM engineers WHERE name = 'Alex Bridgeman'),
 '2025-07-01'::date, '2025-07-31'::date,
 89.0, 8.8, 62, 8, 1, 55, 35, 8.8, 8.9, 8.8, 8.8, 9.2, 85.0, 25, NOW()),

-- Sheema Parwaz (QA: 8.5, CM: 8.2, RS: 8.8, TC: 8.6)
((SELECT id FROM engineers WHERE name = 'Sheema Parwaz'),
 '2025-07-01'::date, '2025-07-31'::date,
 85.0, 8.2, 58, 9, 1, 50, 32, 8.8, 8.5, 8.2, 8.8, 8.6, 82.0, 24, NOW()),

-- Manish Sharma (QA: 8.3, CM: 8.8, RS: 8.2, TC: 8.0)
((SELECT id FROM engineers WHERE name = 'Manish Sharma'),
 '2025-07-01'::date, '2025-07-31'::date,
 83.0, 8.8, 54, 11, 2, 46, 29, 8.2, 8.3, 8.8, 8.2, 8.0, 79.0, 23, NOW())

ON CONFLICT (engineer_id, period_start, period_end) DO UPDATE SET
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
  calculated_at = NOW();

-- Verify the data was inserted
SELECT 
  e.name,
  em.ces_percent as "CES %",
  em.avg_pcc as "Avg PCC",
  em.link_count as "QA Score",
  em.citation_count as "CM Score", 
  em.creation_count as "RS Score",
  em.enterprise_percent as "TC Score",
  em.period_start,
  em.period_end
FROM engineer_metrics em
JOIN engineers e ON e.id = em.engineer_id
WHERE em.period_start = '2025-07-01'
ORDER BY e.name;
