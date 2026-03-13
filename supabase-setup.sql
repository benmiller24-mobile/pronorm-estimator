-- =============================================================
-- Pronorm Dealer Estimator — Supabase Database Setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'dealer' CHECK (role IN ('admin', 'dealer')),
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL DEFAULT 'New Kitchen Project',
  rooms JSONB NOT NULL DEFAULT '[]'::jsonb,
  pg INTEGER NOT NULL DEFAULT 3,
  cf NUMERIC NOT NULL DEFAULT 35,
  show_cost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders(updated_at DESC);

-- 4. Auto-create profile on user signup (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'dealer'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. SECURITY DEFINER helper to check admin status (avoids RLS circular dependency)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. Row Level Security (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  USING (public.is_admin());

-- Orders policies
CREATE POLICY "orders_select" ON public.orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "orders_insert" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_update" ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "orders_delete" ON public.orders FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- =============================================================
-- 7. Create your admin account
-- AFTER running this SQL, go to Supabase Auth → Users → create a user
-- with your email/password. Then run:
--
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
--
-- =============================================================
