-- Ramz secure enterprise schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.business_records (
  id uuid primary key default gen_random_uuid(), source_id text unique not null,
  module text not null, title text, status text, property_id text, unit_id text,
  contract_id text, owner_id text, tenant_id text, amount numeric default 0,
  due_date date, payload jsonb not null default '{}'::jsonb, created_by text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.system_users (
  id uuid primary key default gen_random_uuid(), source_id text unique not null,
  name text not null, username text unique not null, email text, role text not null default 'viewer',
  status text not null default 'active', password_salt text not null, password_hash text not null,
  password_iterations integer not null default 100000, created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), source_id text unique not null,
  action text not null, title text, details text, entity text, entity_id text,
  user_id text, user_name text, created_at timestamptz default now()
);
create table if not exists public.ramz_server_config (
  key text primary key, value text not null, updated_at timestamptz default now()
);

insert into public.ramz_server_config(key,value) values
  ('enterprise_secret_sha256','142b435b4eb936b50eb9608eaf89822189d396ef95f9c82b0559607099b62ffd')
on conflict(key) do update set value=excluded.value,updated_at=now();

insert into public.system_users(source_id,name,username,email,role,status,password_salt,password_hash,password_iterations)
values ('usr-admin','علي عياشي','AliAyashi','info@ramzabdae.com','admin','active',
        'dC7ig2ey2Tj+0rsUM5WuKg==','yDuSSj1x+rv6l0/saEp7GwIPBRDzpAQW7JtRzoJoS+0=',100000)
on conflict(username) do update set name=excluded.name,email=excluded.email,role='admin',status='active',password_salt=excluded.password_salt,password_hash=excluded.password_hash,password_iterations=excluded.password_iterations;

create index if not exists idx_business_records_module on public.business_records(module);
create index if not exists idx_business_records_due on public.business_records(due_date);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
alter table public.business_records enable row level security;
alter table public.system_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ramz_server_config enable row level security;

drop policy if exists ramz_business_select on public.business_records;
drop policy if exists ramz_business_insert on public.business_records;
drop policy if exists ramz_business_update on public.business_records;
drop policy if exists ramz_business_delete on public.business_records;

create or replace function public.ramz_server_call(p_secret text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
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
      'records',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.business_records r),'[]'::jsonb),
      'users',coalesce((select jsonb_agg(to_jsonb(u)-'password_hash'-'password_salt' order by u.created_at) from public.system_users u),'[]'::jsonb),
      'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.audit_logs order by created_at desc limit 500) a),'[]'::jsonb)
    );
  elsif p_action='upsert_record' then
    rec:=p_payload->'record';
    insert into public.business_records(source_id,module,title,status,property_id,unit_id,contract_id,owner_id,tenant_id,amount,due_date,payload,created_by,created_at,updated_at)
    values(rec->>'source_id',rec->>'module',rec->>'title',rec->>'status',rec->>'property_id',rec->>'unit_id',rec->>'contract_id',rec->>'owner_id',rec->>'tenant_id',coalesce((rec->>'amount')::numeric,0),nullif(rec->>'due_date','')::date,coalesce(rec->'payload','{}'::jsonb),rec->>'created_by',coalesce((rec->>'created_at')::timestamptz,now()),now())
    on conflict(source_id) do update set title=excluded.title,status=excluded.status,property_id=excluded.property_id,unit_id=excluded.unit_id,contract_id=excluded.contract_id,owner_id=excluded.owner_id,tenant_id=excluded.tenant_id,amount=excluded.amount,due_date=excluded.due_date,payload=excluded.payload,updated_at=now();
    return jsonb_build_object('ok',true);
  elsif p_action='delete_record' then
    delete from public.business_records where source_id=p_payload->>'source_id'; return jsonb_build_object('ok',true);
  elsif p_action='audit' then
    rec:=p_payload->'record';
    insert into public.audit_logs(source_id,action,title,details,entity,entity_id,user_id,user_name,created_at)
    values(rec->>'source_id',rec->>'action',rec->>'title',rec->>'details',rec->>'entity',rec->>'entity_id',rec->>'user_id',rec->>'user_name',coalesce((rec->>'created_at')::timestamptz,now()))
    on conflict(source_id) do nothing; return jsonb_build_object('ok',true);
  elsif p_action='save_user' then
    rec:=p_payload->'user';
    insert into public.system_users(source_id,name,username,email,role,status,password_salt,password_hash,password_iterations)
    values(rec->>'source_id',rec->>'name',rec->>'username',rec->>'email',rec->>'role','active',rec->>'password_salt',rec->>'password_hash',coalesce((rec->>'password_iterations')::integer,100000));
    return jsonb_build_object('ok',true);
  elsif p_action='toggle_user' then
    uid:=p_payload->>'source_id';
    if uid='usr-admin' then raise exception 'primary admin cannot be disabled'; end if;
    update public.system_users set status=case when status='inactive' then 'active' else 'inactive' end,updated_at=now() where source_id=uid;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'unknown action';
end $$;

revoke all on public.business_records,public.system_users,public.audit_logs,public.ramz_server_config from anon,authenticated;
revoke all on function public.ramz_server_call(text,text,jsonb) from public;
grant execute on function public.ramz_server_call(text,text,jsonb) to anon,authenticated;
