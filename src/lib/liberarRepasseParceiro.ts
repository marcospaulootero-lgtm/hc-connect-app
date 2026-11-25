// HC_LIBERAR_REPASSE_NO_RECIBO_V1
// Ao emitir o recibo (processo pago pelo cliente), libera o repasse no Portal do
// Parceiro para os logins que já recebem repasses desse mesmo parceiro.
// - Só age em processos com débito de terceiro > 0 e parceiro/despachante preenchido.
// - Não mexe em acesso já existente (se foi ocultado, continua oculto).
// - Nunca lança erro: falha aqui não pode atrapalhar o recibo.

type ClienteSupabase = { from: (tabela: string) => any }

const LOTE_IDS = 150

function numeroSeguro(valor: any) {
  if (typeof valor === 'number') return valor
  const texto = String(valor ?? '').trim()
  if (!texto) return 0
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : 0
}

export async function liberarRepasseParceiroAposRecibo(
  supabase: ClienteSupabase,
  financeiroId: string | null | undefined,
  liberadoPor: string | null = null
): Promise<number> {
  try {
    if (!financeiroId) return 0

    const { data: processo, error } = await supabase
      .from('financeiro_embarques')
      .select('id, debito_terceiro, parceiro, despachante')
      .eq('id', financeiroId)
      .maybeSingle()
    if (error || !processo) return 0
    if (numeroSeguro(processo.debito_terceiro) <= 0) return 0

    const parceiro = String(processo.parceiro || processo.despachante || '').trim()
    if (!parceiro) return 0

    const [porParceiro, porDespachante] = await Promise.all([
      supabase.from('financeiro_embarques').select('id').ilike('parceiro', parceiro).limit(1000),
      supabase.from('financeiro_embarques').select('id').ilike('despachante', parceiro).limit(1000),
    ])
    const idsMesmoParceiro = Array.from(
      new Set(
        [...(porParceiro.data || []), ...(porDespachante.data || [])]
          .map((item: any) => String(item.id))
          .filter((id) => id && id !== String(financeiroId))
      )
    )
    if (idsMesmoParceiro.length === 0) return 0

    const usuarios = new Set<string>()
    for (let i = 0; i < idsMesmoParceiro.length; i += LOTE_IDS) {
      const { data } = await supabase
        .from('financeiro_parceiro_acessos')
        .select('usuario_id')
        .eq('ativo', true)
        .in('financeiro_embarque_id', idsMesmoParceiro.slice(i, i + LOTE_IDS))
      for (const acesso of data || []) if (acesso?.usuario_id) usuarios.add(String(acesso.usuario_id))
    }
    if (usuarios.size === 0) return 0

    const { data: existentes } = await supabase
      .from('financeiro_parceiro_acessos')
      .select('usuario_id')
      .eq('financeiro_embarque_id', financeiroId)
    const jaTem = new Set((existentes || []).map((item: any) => String(item.usuario_id)))

    const agora = new Date().toISOString()
    const linhas = Array.from(usuarios)
      .filter((usuarioId) => !jaTem.has(usuarioId))
      .map((usuarioId) => ({
        financeiro_embarque_id: financeiroId,
        usuario_id: usuarioId,
        ativo: true,
        liberado_em: agora,
        liberado_por: liberadoPor,
        atualizado_em: agora,
      }))
    if (linhas.length === 0) return 0

    const { error: erroInsert } = await supabase.from('financeiro_parceiro_acessos').insert(linhas)
    if (erroInsert) {
      console.error('Liberação automática do repasse falhou:', erroInsert.message)
      return 0
    }
    return linhas.length
  } catch (erro) {
    console.error('Liberação automática do repasse falhou:', erro)
    return 0
  }
}
