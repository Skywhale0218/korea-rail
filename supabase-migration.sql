alter table projects add column if not exists open_edit boolean not null default false;

create or replace function can_edit(pid uuid) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from projects where id = pid and owner_id = auth.uid())
      or exists (select 1 from project_members where project_id = pid and user_id = auth.uid())
      or exists (select 1 from projects where id = pid and open_edit and auth.uid() is not null);
$$;
