-- Property management fee compatibility and PostgREST schema refresh.
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

create index if not exists idx_real_properties_postal_code
  on public.real_properties(postal_code);

alter table public.real_units
  add column if not exists floor text;

alter table public.real_contracts
  add column if not exists payment_method text;

alter table public.payments
  add column if not exists unit_num text;

update public.real_properties
set management_fee_type = case
  when coalesce(management_fee_amount, 0) > 0 then 'fixed'
  else 'percentage'
end
where management_fee_type is null
   or management_fee_type not in ('percentage', 'fixed');

notify pgrst, 'reload schema';
