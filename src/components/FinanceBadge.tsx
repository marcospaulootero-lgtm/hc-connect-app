export function FinanceBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const color = s.includes('paga') ? 'bg-emerald-100 text-emerald-700' : s.includes('vencida') || s.includes('pendente') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
  return <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${color}`}>{status}</span>
}
