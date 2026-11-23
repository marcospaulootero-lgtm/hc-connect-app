// HC_AWB_CANCELADO_FATURA_V1
// AWB que a transportadora retirou/cancelou da fatura. O item continua gravado
// (auditoria e possibilidade de restaurar), mas é ignorado em conciliação,
// custos por AWB e análises.
export const STATUS_ITEM_CANCELADO_NA_FATURA = 'CANCELADO_NA_FATURA'

export function itemCanceladoNaFatura(item: { status_lancamento?: string | null } | null | undefined) {
  return String(item?.status_lancamento || '').trim().toUpperCase() === STATUS_ITEM_CANCELADO_NA_FATURA
}
