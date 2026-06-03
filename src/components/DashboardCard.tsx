type Props = {
  titulo: string
  valor: string
  descricao: string
}

export default function DashboardCard({
  titulo,
  valor,
  descricao
}: Props) {

  return (
    <div className="border border-blue-900 rounded-3xl p-6 bg-[#071225]">

      <p className="text-slate-400 text-lg">
        {titulo}
      </p>

      <h2 className="text-5xl font-black mt-4">
        {valor}
      </h2>

      <p className="text-slate-500 mt-4">
        {descricao}
      </p>

    </div>
  )
}