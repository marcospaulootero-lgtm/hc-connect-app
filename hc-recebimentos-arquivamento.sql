-- HC_RECEBIMENTOS_FILTROS_V1
-- Arquivamento individual por login para a tela /cliente/recebimentos.
-- Não altera financeiro_embarques nem a RPC get_meus_repasses_parceiro.

create table if not exists public.repasses_arquivados_clientes (
  financeiro_id text not null,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  arquivado_em timestamptz not null default now(),
  primary key (financeiro_id, cliente_id)
);

alter table public.repasses_arquivados_clientes enable row level security;

revoke all on table public.repasses_arquivados_clientes from anon;
grant select, insert, update, delete on table public.repasses_arquivados_clientes to authenticated;

drop policy if exists "repasses arquivados cliente select proprio" on public.repasses_arquivados_clientes;
create policy "repasses arquivados cliente select proprio"
on public.repasses_arquivados_clientes
for select
to authenticated
using (auth.uid() = cliente_id);

drop policy if exists "repasses arquivados cliente insert proprio" on public.repasses_arquivados_clientes;
create policy "repasses arquivados cliente insert proprio"
on public.repasses_arquivados_clientes
for insert
to authenticated
with check (auth.uid() = cliente_id);

drop policy if exists "repasses arquivados cliente update proprio" on public.repasses_arquivados_clientes;
create policy "repasses arquivados cliente update proprio"
on public.repasses_arquivados_clientes
for update
to authenticated
using (auth.uid() = cliente_id)
with check (auth.uid() = cliente_id);

drop policy if exists "repasses arquivados cliente delete proprio" on public.repasses_arquivados_clientes;
create policy "repasses arquivados cliente delete proprio"
on public.repasses_arquivados_clientes
for delete
to authenticated
using (auth.uid() = cliente_id);
