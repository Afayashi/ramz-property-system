-- ============================================================
-- ramz-setup-complete.sql
-- رمز الإبداع — إعداد قاعدة البيانات الكاملة
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor
-- ============================================================

-- 1. امتدادات
create extension if not exists pgcrypto;

-- ============================================================
-- 2. جداول العقارات والوحدات
-- ============================================================

create table if not exists public.real_properties (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  name text not null,
  type text default 'apartment',
  city text,
  district text,
  address text,
  national_address text,
  region text,
  street text,
  postal_code text,
  building_number text,
  additional_number text,
  short_address text,
  deed_number text,
  deed_expiry date,
  reg_no text,
  reg_id text,
  reg_status text,
  reg_date date,
  plot_no text,
  scheme text,
  area_sqm numeric(14,2),
  usage text,
  reg_issuer text,
  reg_notes text,
  owner_name text,
  owner_phone text,
  owner_id text,
  owner_email text,
  management_fee_type text not null default 'percentage',
  management_fee_pct numeric(7,3) not null default 7,
  management_fee_amount numeric(14,2) not null default 0,
  status text default 'active',
  notes text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.real_units (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  property_id text,
  property_source_id text,
  unit_number text,
  floor text,
  type text,
  area_sqm numeric(14,2),
  rooms integer,
  bathrooms integer,
  status text default 'vacant',
  rent_amount numeric(14,2) default 0,
  notes text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  name text not null,
  national_id text,
  phone text,
  mobile text,
  email text,
  nationality text,
  gender text,
  employer text,
  notes text,
  status text default 'active',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.real_contracts (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  contract_number text,
  ejar_number text,
  property_id text,
  property_source_id text,
  unit_id text,
  unit_source_id text,
  tenant_id text,
  tenant_source_id text,
  tenant_name text,
  start_date date,
  end_date date,
  annual_rent numeric(14,2) default 0,
  payment_periods integer default 1,
  payment_method text,
  status text default 'active',
  notes text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  contract_id text,
  contract_source_id text,
  property_id text,
  unit_id text,
  unit_num text,
  tenant_id text,
  tenant_name text,
  amount numeric(14,2) default 0,
  due_date date,
  paid_date date,
  status text default 'pending',
  payment_method text,
  invoice_number text,
  notes text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  type text,
  title text,
  message text,
  entity text,
  entity_id text,
  severity text default 'info',
  is_read boolean default false,
  sent_at timestamptz,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  property_id text,
  property_source_id text,
  category text,
  description text,
  amount numeric(14,2) default 0,
  date date,
  vendor text,
  invoice_ref text,
  status text default 'paid',
  notes text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. جداول النظام (enterprise)
-- ============================================================

create table if not exists public.business_records (
  id uuid primary key default gen_random_uuid(),
  source_id text unique not null,
  module text not null,
  title text,
  status text,
  property_id text,
  unit_id text,
  contract_id text,
  owner_id text,
  tenant_id text,
  amount numeric default 0,
  due_date date,
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.system_users (
  id uuid primary key default gen_random_uuid(),
  source_id text unique not null,
  name text not null,
  username text unique not null,
  email text,
  role text not null default 'viewer',
  status text not null default 'active',
  password_salt text not null,
  password_hash text not null,
  password_iterations integer not null default 100000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  source_id text unique not null,
  action text not null,
  title text,
  details text,
  entity text,
  entity_id text,
  user_id text,
  user_name text,
  created_at timestamptz default now()
);

create table if not exists public.ramz_server_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- ============================================================
-- 4. Indexes
-- ============================================================

create index if not exists idx_real_properties_source on public.real_properties(source_id);
create index if not exists idx_real_properties_city on public.real_properties(city);
create index if not exists idx_real_properties_postal_code on public.real_properties(postal_code);
create index if not exists idx_real_units_property on public.real_units(property_source_id);
create index if not exists idx_real_units_status on public.real_units(status);
create index if not exists idx_tenants_source on public.tenants(source_id);
create index if not exists idx_real_contracts_status on public.real_contracts(status);
create index if not exists idx_real_contracts_end_date on public.real_contracts(end_date);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_due_date on public.payments(due_date);
create index if not exists idx_expenses_category on public.expenses(category);
create index if not exists idx_business_records_module on public.business_records(module);
create index if not exists idx_business_records_due on public.business_records(due_date);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- ============================================================
-- 5. إضافة الأعمدة المفقودة (آمن للتشغيل مرات متعددة)
-- ============================================================

alter table public.real_properties
  add column if not exists management_fee_type text not null default 'percentage',
  add column if not exists management_fee_pct numeric(7,3) not null default 7,
  add column if not exists management_fee_amount numeric(14,2) not null default 0,
  add column if not exists area_sqm numeric(14,2),
  add column if not exists address text,
  add column if not exists national_address text,
  add column if not exists region text,
  add column if not exists street text,
  add column if not exists postal_code text,
  add column if not exists building_number text,
  add column if not exists additional_number text,
  add column if not exists short_address text;

alter table public.real_units
  add column if not exists floor text;

alter table public.real_contracts
  add column if not exists payment_method text;

alter table public.payments
  add column if not exists unit_num text;

-- ============================================================
-- 6. Row Level Security
-- ============================================================

alter table public.real_properties enable row level security;
alter table public.real_units enable row level security;
alter table public.tenants enable row level security;
alter table public.real_contracts enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.expenses enable row level security;
alter table public.business_records enable row level security;
alter table public.system_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ramz_server_config enable row level security;

-- سياسات الوصول — عام للقراءة والكتابة عبر anon key
drop policy if exists ramz_open_select on public.real_properties;
drop policy if exists ramz_open_insert on public.real_properties;
drop policy if exists ramz_open_update on public.real_properties;
drop policy if exists ramz_open_delete on public.real_properties;

create policy ramz_open_select on public.real_properties for select using (true);
create policy ramz_open_insert on public.real_properties for insert with check (true);
create policy ramz_open_update on public.real_properties for update using (true);
create policy ramz_open_delete on public.real_properties for delete using (true);

do $$ declare tbl text;
begin for tbl in select unnest(array['real_units','tenants','real_contracts','payments','notifications','expenses']) loop
  execute format('drop policy if exists ramz_open_select on public.%I', tbl);
  execute format('drop policy if exists ramz_open_insert on public.%I', tbl);
  execute format('drop policy if exists ramz_open_update on public.%I', tbl);
  execute format('drop policy if exists ramz_open_delete on public.%I', tbl);
  execute format('create policy ramz_open_select on public.%I for select using (true)', tbl);
  execute format('create policy ramz_open_insert on public.%I for insert with check (true)', tbl);
  execute format('create policy ramz_open_update on public.%I for update using (true)', tbl);
  execute format('create policy ramz_open_delete on public.%I for delete using (true)', tbl);
end loop; end; $$;

-- ============================================================
-- 7. إعداد النظام + المستخدم الرئيسي
-- ============================================================

insert into public.ramz_server_config(key,value) values
  ('enterprise_secret_sha256','142b435b4eb936b50eb9608eaf89822189d396ef95f9c82b0559607099b62ffd')
on conflict(key) do update set value=excluded.value, updated_at=now();

insert into public.system_users(source_id,name,username,email,role,status,password_salt,password_hash,password_iterations)
values ('usr-admin','علي عياشي','AliAyashi','info@ramzabdae.com','admin','active',
        'dC7ig2ey2Tj+0rsUM5WuKg==','yDuSSj1x+rv6l0/saEp7GwIPBRDzpAQW7JtRzoJoS+0=',100000)
on conflict(username) do update set
  name=excluded.name, email=excluded.email, role='admin', status='active',
  password_salt=excluded.password_salt, password_hash=excluded.password_hash,
  password_iterations=excluded.password_iterations;

-- ============================================================
-- 8. دالة ramz_server_call
-- ============================================================

create or replace function public.ramz_server_call(
  p_secret text, p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare expected text; result jsonb; rec jsonb; uid text;
begin
  select value into expected from public.ramz_server_config where key='enterprise_secret_sha256';
  if expected is null or encode(digest(coalesce(p_secret,''),'sha256'),'hex') <> expected then
    raise exception 'unauthorized' using errcode='42501';
  end if;

  if p_action='get_user' then
    select to_jsonb(u) into result from public.system_users u
    where lower(u.username)=lower(p_payload->>'username') limit 1;
    return coalesce(result,'null'::jsonb);
  elsif p_action='get_user_by_id' then
    select to_jsonb(u)-'password_hash'-'password_salt' into result from public.system_users u
    where u.source_id=p_payload->>'source_id' limit 1;
    return coalesce(result,'null'::jsonb);
  elsif p_action='load' then
    return jsonb_build_object(
      'records', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.business_records r),'[]'::jsonb),
      'users',   coalesce((select jsonb_agg(to_jsonb(u)-'password_hash'-'password_salt' order by u.created_at) from public.system_users u),'[]'::jsonb),
      'audit',   coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.audit_logs order by created_at desc limit 500) a),'[]'::jsonb)
    );
  elsif p_action='upsert_record' then
    rec := p_payload->'record';
    insert into public.business_records(source_id,module,title,status,property_id,unit_id,contract_id,owner_id,tenant_id,amount,due_date,payload,created_by,created_at,updated_at)
    values(rec->>'source_id',rec->>'module',rec->>'title',rec->>'status',rec->>'property_id',rec->>'unit_id',rec->>'contract_id',rec->>'owner_id',rec->>'tenant_id',
           coalesce((rec->>'amount')::numeric,0),nullif(rec->>'due_date','')::date,coalesce(rec->'payload','{}'::jsonb),rec->>'created_by',
           coalesce((rec->>'created_at')::timestamptz,now()),now())
    on conflict(source_id) do update set
      title=excluded.title,status=excluded.status,property_id=excluded.property_id,unit_id=excluded.unit_id,
      contract_id=excluded.contract_id,owner_id=excluded.owner_id,tenant_id=excluded.tenant_id,
      amount=excluded.amount,due_date=excluded.due_date,payload=excluded.payload,updated_at=now();
    return jsonb_build_object('ok',true);
  elsif p_action='delete_record' then
    delete from public.business_records where source_id=p_payload->>'source_id';
    return jsonb_build_object('ok',true);
  elsif p_action='audit' then
    insert into public.audit_logs(source_id,action,title,details,entity,entity_id,user_id,user_name,created_at)
    values(coalesce(p_payload->>'source_id', gen_random_uuid()::text),
           p_payload->>'action',p_payload->>'title',p_payload->>'details',
           p_payload->>'entity',p_payload->>'entity_id',p_payload->>'user_id',p_payload->>'user_name',now());
    return jsonb_build_object('ok',true);
  elsif p_action='login' then
    select to_jsonb(u) into result from public.system_users u
    where lower(u.username)=lower(p_payload->>'username') and u.status='active' limit 1;
    return coalesce(result,'null'::jsonb);
  end if;
  return jsonb_build_object('ok',false,'error','unknown action: '||p_action);
end; $$;

-- منح صلاحيات لـ anon
grant execute on function public.ramz_server_call to anon;
grant execute on function public.ramz_server_call to authenticated;

-- refresh schema cache
notify pgrst, 'reload schema';

-- ============================================================
-- ✅ اكتمل الإعداد بنجاح
-- ============================================================
select '✅ ramz-setup-complete: تم إعداد قاعدة بيانات رمز الإبداع بنجاح' as result;
