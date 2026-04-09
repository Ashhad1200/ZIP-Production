-- Allow multiple production entries per shift:
-- A single shift (plantId + date + DAY/NIGHT) can now have multiple entries,
-- each recording production of a different variant at different times.
DROP INDEX IF EXISTS "production_entries_plantId_shift_date_key";
