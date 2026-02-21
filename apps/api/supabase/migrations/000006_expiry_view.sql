-- View used by the push-expiry Edge Function cron job.
-- Returns inventory items expiring in exactly 0, 7, 15, or 30 days from today.
CREATE OR REPLACE VIEW expiring_items AS
SELECT
  i.id,
  i.family_id,
  i.expiry_date,
  i.custom_name,
  m.product_name,
  (i.expiry_date::date - CURRENT_DATE) AS days_until_expiry
FROM inventory_items i
LEFT JOIN medications m ON m.id = i.medication_id
WHERE i.deleted_at IS NULL
  AND (i.expiry_date::date - CURRENT_DATE) IN (0, 7, 15, 30);

COMMENT ON VIEW expiring_items IS
  'Items expiring in exactly 0/7/15/30 days — consumed by the push-expiry Edge Function.';
