type Props = {
  status: string
}

export default function StatusBadge({ status }: Props) {
  const cores: Record<string, string> = {
    'Entregue': 'bg-green-600',
    'Em trânsito': 'bg-yellow-500 text-black',
    'Atrasado': 'bg-red-600',
    'Fiscalização': 'bg-purple-600',
    'Liberado': 'bg-blue-600',
  }

  return (
    <span
      className={`
        px-3 py-1 rounded-full text-sm font-semibold
        ${cores[status] || 'bg-slate-700'}
      `}
    >
      {status}
    </span>
  )
}