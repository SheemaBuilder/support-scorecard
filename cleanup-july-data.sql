-- Cleanup script to remove corrupted July 2025 data
-- Run this first to clean up the bad data

-- Delete all July 2025 metrics data
DELETE FROM engineer_metrics 
WHERE period_start = '2025-07-01' 
AND period_end = '2025-07-31';

-- Verify cleanup
SELECT 
  e.name,
  em.period_start,
  em.period_end,
  em.ces_percent
FROM engineer_metrics em
JOIN engineers e ON e.id = em.engineer_id
WHERE em.period_start = '2025-07-01'
ORDER BY e.name;

-- This should return no rows after cleanup
