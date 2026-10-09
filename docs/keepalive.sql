-- Supabase 대시보드 → SQL Editor에서 한 번 실행한다. keepalive 작업(.github/workflows/keepalive.yml)이 이 표를 읽는다.
-- 학생 데이터는 넣지 않는다. 행 하나뿐이고 누구나 읽기만 할 수 있다.
create table if not exists public.keepalive (id int primary key);
insert into public.keepalive (id) values (1) on conflict do nothing;
alter table public.keepalive enable row level security;
drop policy if exists "keepalive read" on public.keepalive;
create policy "keepalive read" on public.keepalive for select to anon using (true);
grant select on public.keepalive to anon;
