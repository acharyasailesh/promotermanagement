const fs = require('fs');

const targetFile = "d:\\shree bihani investment pvt ltd\\SASS\\init_schema.sql";

if (!fs.existsSync(targetFile)) {
  console.error('File not found:', targetFile);
  process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// 1. Update line 15 to default super_admin
const originalRole = "role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin','admin','editor'))";
const newRole = "role TEXT DEFAULT 'super_admin' CHECK (role IN ('super_admin','admin','editor'))";

if (content.includes(originalRole)) {
  content = content.replace(originalRole, newRole);
  console.log('Role default modified to super_admin');
} else {
  console.log('Warning: could not find exact match to update profile role default right now');
}

// 2. Append missing patch content
const patchContent = `

-- ============================================
-- 18. MISSING COLUMNS & TABLES PATCH
-- ============================================

-- Patch Company Settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS default_interest_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_charge numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS grace_period int DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_max_percentage numeric DEFAULT 50.00;

-- Patch Shareholders
ALTER TABLE public.shareholders
ADD COLUMN IF NOT EXISTS cit_address JSONB,
ADD COLUMN IF NOT EXISTS first_name_ne TEXT,
ADD COLUMN IF NOT EXISTS middle_name_ne TEXT,
ADD COLUMN IF NOT EXISTS last_name_ne TEXT,
ADD COLUMN IF NOT EXISTS father_name_ne TEXT,
ADD COLUMN IF NOT EXISTS grandfather_name_ne TEXT,
ADD COLUMN IF NOT EXISTS nominee_name_ne TEXT,
ADD COLUMN IF NOT EXISTS citizenship_photo_url TEXT,
ADD COLUMN IF NOT EXISTS nid_photo_url TEXT,
ADD COLUMN IF NOT EXISTS nominee_citizenship_url TEXT,
ADD COLUMN IF NOT EXISTS nominee_profile_pic_url TEXT,
ADD COLUMN IF NOT EXISTS nominee_name TEXT,
ADD COLUMN IF NOT EXISTS nominee_relation TEXT,
ADD COLUMN IF NOT EXISTS share_form_url TEXT;

-- Create Missing Banking / Investment / Petty Cash Tables
CREATE TABLE IF NOT EXISTS public.company_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_name TEXT,
  account_number TEXT NOT NULL,
  branch TEXT,
  initial_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.company_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  investment_type TEXT,
  principal_amount DECIMAL(15,2) NOT NULL,
  investment_date DATE NOT NULL,
  maturity_date DATE,
  status TEXT DEFAULT 'active',
  company_bank_id UUID REFERENCES public.company_banks(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ,
  cheque_number TEXT,
  cheque_image_url TEXT
);

CREATE TABLE IF NOT EXISTS public.investment_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id UUID REFERENCES public.fiscal_years(id),
  source_name TEXT,
  gross_amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL,
  return_date DATE NOT NULL,
  payment_method TEXT,
  remarks TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ,
  cheque_number TEXT,
  cheque_image_url TEXT
);

CREATE TABLE IF NOT EXISTS public.petty_cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow')),
  source TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  bank_id UUID REFERENCES public.company_banks(id),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Turn on RLS for the new tables
ALTER TABLE public.company_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cb_select" ON public.company_banks FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_all" ON public.company_banks FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "ci_select" ON public.company_investments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ci_all" ON public.company_investments FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "ir_select" ON public.investment_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "ir_all" ON public.investment_returns FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "pcl_select" ON public.petty_cash_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "pcl_all" ON public.petty_cash_ledger FOR ALL TO authenticated USING (public.is_admin());
`;

content += patchContent;

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully fully fully updated init_schema.sql');
