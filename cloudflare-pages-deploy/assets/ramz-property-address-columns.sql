-- Ramz property national-address columns.
-- Safe to run repeatedly. Existing rows and relations are not changed.

alter table public.real_properties
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

comment on column public.real_properties.address is 'Display address extracted from the lease contract or entered manually';
comment on column public.real_properties.national_address is 'Saudi national address in full';
comment on column public.real_properties.postal_code is 'Saudi five-digit postal code';
comment on column public.real_properties.building_number is 'National address building number';
comment on column public.real_properties.additional_number is 'National address additional number';
comment on column public.real_properties.short_address is 'Saudi short national address';

notify pgrst, 'reload schema';
