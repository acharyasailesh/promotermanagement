-- ============================================
-- GLOBAL BIHANI INVESTMENT - COMPLETE SQL MIGRATION
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/eykgtrxqtpteamzkovzy/sql)
-- ============================================

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  website_url TEXT,
  social_links JSONB DEFAULT '{"facebook":"","tiktok":"","instagram":""}',
  phone_number TEXT,
  working_hours TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin','admin','editor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. FISCAL YEARS
CREATE TABLE public.fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SHAREHOLDERS
CREATE TABLE public.shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  father_name TEXT,
  grandfather_name TEXT,
  spouse_name TEXT,
  children JSONB DEFAULT '[]',
  in_laws JSONB DEFAULT '{}',
  temp_address JSONB,
  perm_address JSONB NOT NULL,
  citizenship_no TEXT UNIQUE NOT NULL,
  citizenship_district TEXT NOT NULL,
  citizenship_issue_date DATE NOT NULL,
  email TEXT,
  pan_no TEXT,
  nid_no TEXT,
  demat_no TEXT,
  bank_details JSONB NOT NULL DEFAULT '[]',
  profile_pic_url TEXT,
  kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected')),
  kyc_notes TEXT,
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by UUID REFERENCES public.profiles(id),
  member_since DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 4. NOMINEES
CREATE TABLE public.nominees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  father_name TEXT,
  grandfather_name TEXT,
  spouse_name TEXT,
  address TEXT,
  citizenship_no TEXT,
  citizenship_district TEXT,
  citizenship_issue_date DATE,
  pan_no TEXT,
  nid_no TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INVESTMENTS
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
  fiscal_year_id UUID REFERENCES public.fiscal_years(id),
  investment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','bank')),
  bank_name TEXT,
  bank_account_no TEXT,
  proof_url TEXT,
  payment_slip_url TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','cancelled')),
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- 6. DIVIDENDS
CREATE TABLE public.dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
  fiscal_year_id UUID NOT NULL REFERENCES public.fiscal_years(id),
  total_investment DECIMAL(15,2),
  dividend_rate DECIMAL(5,4),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','cancelled')),
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash','bank','check')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 7. SHARE CERTIFICATES
CREATE TABLE public.share_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
  certificate_no TEXT UNIQUE NOT NULL,
  num_shares INTEGER NOT NULL CHECK (num_shares > 0),
  face_value DECIMAL(15,2) NOT NULL CHECK (face_value > 0),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','transferred','cancelled')),
  transferred_to UUID REFERENCES public.shareholders(id),
  transferred_at TIMESTAMPTZ,
  transfer_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 8. EXPENSE CATEGORIES
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.expense_categories (name, description, sort_order) VALUES
  ('Office Rent', 'Monthly office space rental', 1),
  ('Salary & Wages', 'Employee compensation', 2),
  ('Utilities', 'Electricity, water, internet', 3),
  ('Marketing', 'Advertising and promotion', 4),
  ('Travel', 'Business travel expenses', 5),
  ('Stationery', 'Office supplies', 6),
  ('Miscellaneous', 'Other operational costs', 7);

-- 9. EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.expense_categories(id),
  fiscal_year_id UUID REFERENCES public.fiscal_years(id),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash','bank','check')),
  receipt_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- 10. BOARD MEETINGS
CREATE TABLE public.board_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  location TEXT,
  agenda TEXT,
  attendees JSONB DEFAULT '[]',
  decisions TEXT,
  minutes_url TEXT,
  fiscal_year_id UUID REFERENCES public.fiscal_years(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.board_meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. LOANS
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
  fiscal_year_id UUID REFERENCES public.fiscal_years(id),
  principal DECIMAL(15,2) NOT NULL CHECK (principal > 0),
  interest_rate DECIMAL(5,4) DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount_repaid DECIMAL(15,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','closed','overdue')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 12. NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('investment','kyc','expense','dividend','loan','meeting','system')),
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. COMPANY SETTINGS
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT 'Global Bihani Investment Pvt Ltd',
  address TEXT DEFAULT 'Pokhara, Newroad',
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  social_links JSONB DEFAULT '{"facebook":"","tiktok":"","instagram":""}',
  working_hours JSONB,
  registration_no TEXT,
  pan_no TEXT,
  share_face_value DECIMAL(15,2) DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.company_settings (company_name, address) VALUES
  ('Global Bihani Investment Pvt Ltd', 'Pokhara, Newroad');

-- 14. AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES public.profiles(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_shareholders_updated_at BEFORE UPDATE ON public.shareholders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data, performed_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, gen_random_uuid()),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)::JSONB ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END,
    auth.uid()
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_shareholders AFTER INSERT OR UPDATE OR DELETE ON public.shareholders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_investments AFTER INSERT OR UPDATE OR DELETE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_dividends AFTER INSERT OR UPDATE OR DELETE ON public.dividends
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_share_certificates AFTER INSERT OR UPDATE OR DELETE ON public.share_certificates
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_loans AFTER INSERT OR UPDATE OR DELETE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- SHAREHOLDERS
CREATE POLICY "shareholders_select" ON public.shareholders FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "shareholders_insert" ON public.shareholders FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "shareholders_update" ON public.shareholders FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "shareholders_delete" ON public.shareholders FOR DELETE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));

-- NOMINEES
CREATE POLICY "nominees_select" ON public.nominees FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "nominees_insert" ON public.nominees FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "nominees_update" ON public.nominees FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "nominees_delete" ON public.nominees FOR DELETE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));

-- INVESTMENTS
CREATE POLICY "investments_select" ON public.investments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "investments_insert" ON public.investments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "investments_update" ON public.investments FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "investments_delete" ON public.investments FOR DELETE TO authenticated USING (public.get_user_role() = 'super_admin');

-- DIVIDENDS
CREATE POLICY "dividends_select" ON public.dividends FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "dividends_insert" ON public.dividends FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "dividends_update" ON public.dividends FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "dividends_delete" ON public.dividends FOR DELETE TO authenticated USING (public.get_user_role() = 'super_admin');

-- SHARE CERTIFICATES
CREATE POLICY "certificates_select" ON public.share_certificates FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "certificates_insert" ON public.share_certificates FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "certificates_update" ON public.share_certificates FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "certificates_delete" ON public.share_certificates FOR DELETE TO authenticated USING (public.get_user_role() = 'super_admin');

-- FISCAL YEARS
CREATE POLICY "fiscal_years_select" ON public.fiscal_years FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "fiscal_years_insert" ON public.fiscal_years FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "fiscal_years_update" ON public.fiscal_years FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));

-- EXPENSE CATEGORIES
CREATE POLICY "categories_select" ON public.expense_categories FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "categories_insert" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "categories_update" ON public.expense_categories FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "categories_delete" ON public.expense_categories FOR DELETE TO authenticated USING (public.get_user_role() = 'super_admin');

-- EXPENSES
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO authenticated USING (public.get_user_role() = 'super_admin');

-- BOARD MEETINGS
CREATE POLICY "meetings_select" ON public.board_meetings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "meetings_insert" ON public.board_meetings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "meetings_update" ON public.board_meetings FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));

-- MEETING ACTION ITEMS
CREATE POLICY "action_items_select" ON public.meeting_action_items FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "action_items_insert" ON public.meeting_action_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "action_items_update" ON public.meeting_action_items FOR UPDATE TO authenticated USING (public.is_admin());

-- LOANS
CREATE POLICY "loans_select" ON public.loans FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "loans_insert" ON public.loans FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "loans_update" ON public.loans FOR UPDATE TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));
CREATE POLICY "loans_delete" ON public.loans FOR DELETE TO authenticated USING (public.get_user_role() = 'super_admin');

-- NOTIFICATIONS
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));

-- COMPANY SETTINGS
CREATE POLICY "settings_select" ON public.company_settings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "settings_update" ON public.company_settings FOR UPDATE TO authenticated USING (public.get_user_role() = 'super_admin');

-- AUDIT LOGS (read-only for super_admin)
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_user_role() = 'super_admin');

-- ============================================
-- STORAGE BUCKETS
-- Run this separately if the above succeeds
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('profile-pictures', 'profile-pictures', true),
  ('investment-proofs', 'investment-proofs', false),
  ('expense-receipts', 'expense-receipts', false),
  ('documents', 'documents', false);

CREATE POLICY "auth_upload_profile_pics" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-pictures');
CREATE POLICY "public_read_profile_pics" ON storage.objects FOR SELECT TO public USING (bucket_id = 'profile-pictures');
CREATE POLICY "auth_update_profile_pics" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-pictures');
CREATE POLICY "auth_upload_investment_proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'investment-proofs');
CREATE POLICY "auth_read_investment_proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'investment-proofs');
CREATE POLICY "auth_upload_expense_receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expense-receipts');
CREATE POLICY "auth_read_expense_receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'expense-receipts');
CREATE POLICY "auth_upload_documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "auth_read_documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');

-- ============================================
-- LOAN SETTINGS & REFERENCES UPDATE
-- ============================================
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS loan_max_percentage DECIMAL(5,2) DEFAULT 50.00;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reference_1_id UUID REFERENCES public.shareholders(id);
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reference_2_id UUID REFERENCES public.shareholders(id);
