-- ============================================================================
-- 010_custom_field_sections.sql (2026-05-28) — Section grouping for custom
-- fields. Lets admins organize the fields they define into named sections
-- that render as grouped headings on the form and the record detail, giving
-- them control over page STRUCTURE (not just which fields exist).
--
-- Additive + nullable: existing fields with no section fall into a default
-- "Additional fields" group, so this changes nothing until an admin uses it.
-- ============================================================================

ALTER TABLE custom_field_definitions
  ADD COLUMN IF NOT EXISTS section text;

-- Demo seed: group the example fields into two readable sections so the
-- grouping is visible out of the box.
UPDATE custom_field_definitions SET section = 'Property & Lifecycle'
 WHERE entity = 'asset' AND field_key IN ('property_pass_number', 'lifecycle_status');

UPDATE custom_field_definitions SET section = 'Compliance'
 WHERE entity = 'asset' AND field_key IN ('fisma_system', 'warranty_expiration', 'encryption_verified');
