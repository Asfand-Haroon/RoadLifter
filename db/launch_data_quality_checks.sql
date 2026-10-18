-- RoadLifter launch data quality checks
-- Run these against staging before production launch.
-- Each query returns rows that should be reviewed and fixed before public launch.

-- 1. Duplicate users by email
SELECT
  'duplicate_emails' AS check_name,
  email,
  COUNT(*) AS row_count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- 2. Invalid or incomplete user records
SELECT
  'invalid_users' AS check_name,
  id,
  email,
  role,
  name,
  CASE
    WHEN name IS NULL OR btrim(name) = '' THEN 'missing_name'
    WHEN email IS NULL OR btrim(email) = '' THEN 'missing_email'
    WHEN role NOT IN ('DRIVER', 'SENDER', 'ADMIN') THEN 'invalid_role'
    ELSE 'unknown'
  END AS issue
FROM users
WHERE name IS NULL OR btrim(name) = ''
   OR email IS NULL OR btrim(email) = ''
   OR role NOT IN ('DRIVER', 'SENDER', 'ADMIN');

-- 3. Driver verification anomalies
SELECT
  'driver_verification_anomalies' AS check_name,
  u.id,
  u.email,
  u.role,
  u.verification_status,
  u.verified_at,
  u.profile_completed,
  CASE
    WHEN u.role = 'DRIVER' AND u.verification_status = 'VERIFIED' AND u.verified_at IS NULL THEN 'verified_without_timestamp'
    WHEN u.role = 'DRIVER' AND u.verification_status IS NULL THEN 'missing_verification_status'
    WHEN u.role = 'DRIVER' AND u.verification_status NOT IN ('PENDING', 'VERIFIED', 'REJECTED') THEN 'invalid_verification_status'
    WHEN u.role = 'DRIVER' AND u.profile_completed = true AND (u.legal_name IS NULL OR u.license_number IS NULL) THEN 'profile_marked_complete_without_required_fields'
    ELSE 'unknown'
  END AS issue
FROM users u
WHERE u.role = 'DRIVER'
  AND (
    u.verification_status NOT IN ('PENDING', 'VERIFIED', 'REJECTED')
    OR (u.verification_status = 'VERIFIED' AND u.verified_at IS NULL)
    OR (u.profile_completed = true AND (u.legal_name IS NULL OR u.license_number IS NULL))
  );

-- 4. Drivers missing live-location data
SELECT
  'drivers_missing_location' AS check_name,
  u.id,
  u.email,
  u.role
FROM users u
LEFT JOIN driver_locations dl ON dl.driver_id = u.id
WHERE u.role = 'DRIVER'
  AND dl.id IS NULL;

-- 5. Shipment rows with invalid coordinates or required fields
SELECT
  'shipment_coordinate_anomalies' AS check_name,
  c.id,
  c.sender_id,
  c.driver_id,
  c.status,
  c.pickup_lat,
  c.pickup_lng,
  c.delivery_lat,
  c.delivery_lng,
  CASE
    WHEN c.pickup_lat IS NULL OR c.pickup_lng IS NULL THEN 'missing_pickup_coordinates'
    WHEN c.pickup_lat < -90 OR c.pickup_lat > 90 THEN 'invalid_pickup_lat'
    WHEN c.pickup_lng < -180 OR c.pickup_lng > 180 THEN 'invalid_pickup_lng'
    WHEN c.delivery_lat IS NOT NULL AND (c.delivery_lat < -90 OR c.delivery_lat > 90) THEN 'invalid_delivery_lat'
    WHEN c.delivery_lng IS NOT NULL AND (c.delivery_lng < -180 OR c.delivery_lng > 180) THEN 'invalid_delivery_lng'
    ELSE 'unknown'
  END AS issue
FROM cargo c
WHERE c.pickup_lat IS NULL
   OR c.pickup_lng IS NULL
   OR c.pickup_lat < -90 OR c.pickup_lat > 90
   OR c.pickup_lng < -180 OR c.pickup_lng > 180
   OR (c.delivery_lat IS NOT NULL AND (c.delivery_lat < -90 OR c.delivery_lat > 90))
   OR (c.delivery_lng IS NOT NULL AND (c.delivery_lng < -180 OR c.delivery_lng > 180));

-- 6. Shipment lifecycle anomalies
SELECT
  'shipment_lifecycle_anomalies' AS check_name,
  c.id,
  c.sender_id,
  c.driver_id,
  c.status,
  c.accepted_at,
  CASE
    WHEN c.status = 'ACCEPTED' AND c.accepted_at IS NULL THEN 'accepted_without_timestamp'
    WHEN c.status = 'DELIVERED' AND c.driver_id IS NULL THEN 'delivered_without_driver'
    WHEN c.status = 'IN_TRANSIT' AND c.driver_id IS NULL THEN 'in_transit_without_driver'
    WHEN c.status = 'CANCELLED' AND c.accepted_at IS NOT NULL AND c.driver_id IS NOT NULL THEN 'cancelled_after_acceptance_review'
    ELSE 'unknown'
  END AS issue
FROM cargo c
WHERE (c.status = 'ACCEPTED' AND c.accepted_at IS NULL)
   OR (c.status = 'DELIVERED' AND c.driver_id IS NULL)
   OR (c.status = 'IN_TRANSIT' AND c.driver_id IS NULL)
   OR (c.status = 'CANCELLED' AND c.accepted_at IS NOT NULL AND c.driver_id IS NOT NULL);

-- 7. Invalid ratings or duplicate ratings per cargo-user
SELECT
  'rating_anomalies' AS check_name,
  r.id,
  r.cargo_id,
  r.rater_id,
  r.ratee_id,
  r.rating,
  CASE
    WHEN r.rating < 1 OR r.rating > 5 THEN 'rating_out_of_range'
    WHEN r.rater_id IS NULL OR r.ratee_id IS NULL THEN 'missing_rater_or_ratee'
    ELSE 'unknown'
  END AS issue
FROM ratings r
WHERE r.rating < 1 OR r.rating > 5
   OR r.rater_id IS NULL
   OR r.ratee_id IS NULL;

SELECT
  'duplicate_ratings' AS check_name,
  cargo_id,
  rater_id,
  COUNT(*) AS row_count
FROM ratings
GROUP BY cargo_id, rater_id
HAVING COUNT(*) > 1;

-- 8. Driver location anomalies
SELECT
  'driver_location_anomalies' AS check_name,
  dl.id,
  dl.driver_id,
  dl.lat,
  dl.lng,
  dl.speed,
  dl.heading,
  CASE
    WHEN dl.lat IS NULL OR dl.lng IS NULL THEN 'missing_coordinates'
    WHEN dl.lat < -90 OR dl.lat > 90 THEN 'invalid_lat'
    WHEN dl.lng < -180 OR dl.lng > 180 THEN 'invalid_lng'
    WHEN dl.speed IS NOT NULL AND (dl.speed < 0 OR dl.speed > 200) THEN 'invalid_speed'
    WHEN dl.heading IS NOT NULL AND (dl.heading < 0 OR dl.heading > 360) THEN 'invalid_heading'
    ELSE 'unknown'
  END AS issue
FROM driver_locations dl
WHERE dl.lat IS NULL OR dl.lng IS NULL
   OR dl.lat < -90 OR dl.lat > 90
   OR dl.lng < -180 OR dl.lng > 180
   OR (dl.speed IS NOT NULL AND (dl.speed < 0 OR dl.speed > 200))
   OR (dl.heading IS NOT NULL AND (dl.heading < 0 OR dl.heading > 360));

-- 9. Summary: quick launch-readiness signal
SELECT
  'launch_readiness_summary' AS check_name,
  'users' AS entity,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE name IS NULL OR btrim(name) = '') AS missing_names,
  COUNT(*) FILTER (WHERE email IS NULL OR btrim(email) = '') AS missing_emails,
  COUNT(*) FILTER (WHERE role NOT IN ('DRIVER', 'SENDER', 'ADMIN')) AS invalid_roles
FROM users
UNION ALL
SELECT
  'launch_readiness_summary' AS check_name,
  'cargo' AS entity,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE pickup_lat IS NULL OR pickup_lng IS NULL) AS missing_pickup_coordinates,
  COUNT(*) FILTER (WHERE status NOT IN ('OPEN', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')) AS invalid_statuses,
  COUNT(*) FILTER (WHERE status = 'ACCEPTED' AND accepted_at IS NULL) AS accepted_without_timestamp
FROM cargo
UNION ALL
SELECT
  'launch_readiness_summary' AS check_name,
  'ratings' AS entity,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE rating < 1 OR rating > 5) AS invalid_ratings,
  COUNT(*) FILTER (WHERE rater_id IS NULL OR ratee_id IS NULL) AS missing_rater_or_ratee,
  COUNT(*) FILTER (WHERE cargo_id IS NULL) AS missing_cargo_id
FROM ratings;
