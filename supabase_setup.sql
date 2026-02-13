-- ==============================================================================
-- SUPABASE SETUP SCRIPT
-- Run this in the SQL Editor of your Supabase Project
-- ==============================================================================

-- Enable UUID extension for unique IDs
create extension if not exists "uuid-ossp";

-- 1. Create Trips Table
create table public.trips (
  id uuid default uuid_generate_v4() primary key,
  trip_id text,          -- The Manual Booking ID (e.g. B-101)
  company_name text,
  booked_by text,
  report_to text,
  car_type text,
  trip_type text,
  source text,
  destination text,
  vehicle_reg_no text,
  start_km numeric,
  end_km numeric,
  total_km numeric,
  start_date_time timestamptz,
  end_date_time timestamptz,
  total_time text,
  toll_parking numeric,
  additional_km numeric default 0,
  signature text,        -- Stores Base64 string of signature
  created_at timestamptz default now()
);

-- 2. Create Companies Table
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  created_at timestamptz default now()
);

-- 3. Create Car Types Table
create table public.car_types (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  created_at timestamptz default now()
);

-- 4. Create Settings Table
create table public.settings (
  key text primary key,
  value text
);

-- 5. Insert Default Data (Optional)

-- Default Companies
insert into public.companies (name) values 
('Vista Travels HQ') 
on conflict do nothing;

-- Default Car Types
insert into public.car_types (name) values 
('Sedan'), ('SUV'), ('Innova'), ('Crysta'), ('Tempo Traveller') 
on conflict do nothing;

-- Default Settings
insert into public.settings (key, value) values 
  ('agencyName', 'Vista Travels'),
  ('addressLine1', 'No. 51, Brodies Road, Karayanchavadi,'),
  ('addressLine2', 'Poonamallee, Chennai - 600056'),
  ('contactNumber', '+91 98400 12345'),
  ('email', 'bookings@vistatravels.com')
on conflict do nothing;

-- 6. Row Level Security (RLS)
-- For a simple internal tool, we allow public access. 
-- For production with sensitive data, you should configure Auth policies.

alter table public.trips enable row level security;
alter table public.companies enable row level security;
alter table public.car_types enable row level security;
alter table public.settings enable row level security;

-- Create policies to allow public read/write (since we use anon key for simplicity)
create policy "Enable access for all users" on public.trips for all using (true) with check (true);
create policy "Enable access for all users" on public.companies for all using (true) with check (true);
create policy "Enable access for all users" on public.car_types for all using (true) with check (true);
create policy "Enable access for all users" on public.settings for all using (true) with check (true);
