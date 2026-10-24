-- HC_FILA_COTACOES_V1
-- Expõe ao cliente somente a posição numérica das próprias cotações na fila.
-- Não retorna dados de outros clientes.

create or replace function public.get_minhas_posicoes_fila_cotacoes()
returns table (
  cotacao_id uuid,
  posicao bigint,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with fila as (
    select
      c.id as cotacao_id,
      c.usuario_id,
      row_number() over (
        order by c.criado_em asc nulls last, c.id asc
      )::bigint as posicao,
      count(*) over ()::bigint as total
    from public.cotacoes c
    where coalesce(c.status, 'AGUARDANDO ANÁLISE') = 'AGUARDANDO ANÁLISE'
      and c.embarque_id is null
      and coalesce(c.dados_emissor ->> 'arquivada_admin', 'false') <> 'true'
  )
  select
    fila.cotacao_id,
    fila.posicao,
    fila.total
  from fila
  where fila.usuario_id = auth.uid()
    and exists (
      select 1
      from public.perfis p
      where p.id = auth.uid()
        and coalesce(p.ativo, true) = true
    )
  order by fila.posicao;
$$;

revoke all on function public.get_minhas_posicoes_fila_cotacoes() from public;
grant execute on function public.get_minhas_posicoes_fila_cotacoes() to authenticated;
