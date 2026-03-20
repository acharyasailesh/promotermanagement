-- Add Nepali Name columns to shareholders table
ALTER TABLE public.shareholders
  ADD COLUMN IF NOT EXISTS first_name_ne TEXT,
  ADD COLUMN IF NOT EXISTS middle_name_ne TEXT,
  ADD COLUMN IF NOT EXISTS last_name_ne TEXT,
  ADD COLUMN IF NOT EXISTS father_name_ne TEXT,
  ADD COLUMN IF NOT EXISTS grandfather_name_ne TEXT,
  ADD COLUMN IF NOT EXISTS nominee_name_ne TEXT;

COMMENT ON COLUMN public.shareholders.first_name_ne IS 'First Name in Nepali Unicode';
COMMENT ON COLUMN public.shareholders.middle_name_ne IS 'Middle Name in Nepali Unicode';
COMMENT ON COLUMN public.shareholders.last_name_ne IS 'Last Name in Nepali Unicode';
COMMENT ON COLUMN public.shareholders.father_name_ne IS 'Father Name in Nepali Unicode';
COMMENT ON COLUMN public.shareholders.grandfather_name_ne IS 'Grandfather Name in Nepali Unicode';
COMMENT ON COLUMN public.shareholders.nominee_name_ne IS 'Nominee Name in Nepali Unicode';
