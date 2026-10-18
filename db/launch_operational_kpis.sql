-- RoadLifter launch operational KPI queries
-- Run these against production or staging to monitor launch health.
-- This file intentionally avoids exposing raw personal data in aggregate results.

-- 1. Total users by role
SELECT
  role,
  COUNT(*) AS user_count
FROM users
GROUP BY role
ORDER BY role;

-- 2. Active vs inactive users
SELECT
  CASE WHEN is_active = true THEN 'active' ELSE 'inactive' END AS status,
  COUNT(*) AS user_count
FROM users
GROUP BY is_active
ORDER BY status;

-- 3. Pending driver applications and verification rates
SELECT
  verification_status,
  COUNT(*) AS driver_count
FROM users
WHERE role = 'DRIVER'
GROUP BY verification_status
ORDER BY verification_status;

-- 4. Driver locations currently active
SELECT
  COUNT(*) AS active_driver_locations
FROM driver_locations
WHERE is_active = true;

-- 5. Shipments by status
SELECT
  status,
  COUNT(*) AS shipment_count
FROM cargo
GROUP BY status
ORDER BY status;

-- 6. Average time from shipment creation to acceptance
SELECT
  ROUND(AVG(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 3600), 2) AS avg_hours_to_acceptance
FROM cargo
WHERE accepted_at IS NOT NULL;

-- 7. Average time from accepted to delivered
SELECT
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - accepted_at)) / 3600), 2) AS avg_hours_to_delivery
FROM cargo
WHERE status = 'DELIVERED'
  AND accepted_at IS NOT NULL;

-- 8. Completed shipments per driver
SELECT
  driver_id,
  COUNT(*) AS delivered_shipments
FROM cargo
WHERE status = 'DELIVERED'
GROUP BY driver_id
ORDER BY delivered_shipments DESC
LIMIT 20;

-- 9. Average rating by driver
SELECT
  ratee_id AS driver_id,
  ROUND(AVG(rating)::numeric, 2) AS avg_rating,
  COUNT(*) AS rating_count
FROM ratings
GROUP BY ratee_id
ORDER BY avg_rating DESC, rating_count DESC;

-- 10. Shipment value by status
SELECT
  status,
  ROUND(COALESCE(SUM(budget), 0), 2) AS total_budget_value
FROM cargo
GROUP BY status
ORDER BY status;

-- 11. Active shipment volume by pickup region (example only; requires region extraction)
-- Replace region extraction with your actual geography logic or geocoder output.
SELECT
  'pickup_region_placeholder' AS region,
  COUNT(*) AS shipment_count
FROM cargo
WHERE status IN ('OPEN', 'ACCEPTED', 'IN_TRANSIT');

-- 12. Recent activity summary for launch-day operations
SELECT
  DATE(created_at) AS activity_date,
  COUNT(*) FILTER (WHERE role = 'DRIVER') AS new_drivers,
  COUNT(*) FILTER (WHERE role = 'SENDER') AS new_senders,
  COUNT(*) FILTER (WHERE role = 'ADMIN') AS new_admins
FROM users
GROUP BY DATE(created_at)
ORDER BY activity_date DESC;

-- 13. Driver application funnel
SELECT
  'submitted' AS stage,
  COUNT(*) AS count
FROM users
WHERE role = 'DRIVER' AND profile_completed = false
UNION ALL
SELECT
  'profile_completed' AS stage,
  COUNT(*) AS count
FROM users
WHERE role = 'DRIVER' AND profile_completed = true
UNION ALL
SELECT
  'verified' AS stage,
  COUNT(*) AS count
FROM users
WHERE role = 'DRIVER' AND verification_status = 'VERIFIED'
UNION ALL
SELECT
  'rejected' AS stage,
  COUNT(*) AS count
FROM users
WHERE role = 'DRIVER' AND verification_status = 'REJECTED';

-- 14. Ratings quality summary
SELECT
  COUNT(*) AS total_ratings,
  COUNT(*) FILTER (WHERE rating >= 4) AS four_plus_ratings,
  ROUND(AVG(rating)::numeric, 2) AS avg_rating
FROM ratings;

-- 15. Blacklist and moderation summary
SELECT
  COUNT(*) FILTER (WHERE is_blacklisted = true) AS blacklisted_users,
  COUNT(*) FILTER (WHERE is_blacklisted = false) AS active_non_blacklisted_users
FROM users;
