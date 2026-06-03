'use client'

export default function SuportePage() {
  const email = 'marcos@hcbhz.com'
  const telefone = '3136436175'
  const whatsapp = '553136436175'

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">Suporte</h1>
        <p className="text-slate-400 text-lg">
          Central de atendimento e chamados
        </p>
      </div>

      <section className="card mb-8">
        <div className="flex justify-between gap-8 items-center mb-8">
          <div>
            <h2 className="text-3xl font-black mb-2">
              Como podemos ajudar?
            </h2>
            <p className="text-slate-400">
              Abra um chamado ou entre em contato com nossa equipe.
            </p>
          </div>

          <div className="text-7xl">🎧</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="border border-blue-900 rounded-2xl p-6 bg-[#071226]">
            <div className="text-4xl mb-4">🎧</div>
            <h3 className="text-xl font-bold mb-2">Abrir chamado</h3>
            <p className="text-slate-400 mb-6">
              Abra um novo chamado para nossa equipe.
            </p>

            <a
              href={`mailto:${email}?subject=Novo chamado - HC Connect`}
              className="block text-center bg-blue-600 hover:bg-blue-500 transition rounded-2xl font-bold py-4"
            >
              Novo chamado
            </a>
          </div>

          <div className="border border-blue-900 rounded-2xl p-6 bg-[#071226]">
            <div className="text-4xl mb-4">✉️</div>
            <h3 className="text-xl font-bold mb-2">E-mail</h3>
            <p className="text-slate-400 mb-6">{email}</p>

            <a
              href={`mailto:${email}`}
              className="block text-center bg-blue-600 hover:bg-blue-500 transition rounded-2xl font-bold py-4"
            >
              Enviar e-mail
            </a>
          </div>

          <div className="border border-blue-900 rounded-2xl p-6 bg-[#071226]">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-bold mb-2">WhatsApp</h3>
            <p className="text-slate-400 mb-6">
              Atendimento rápido via WhatsApp.
            </p>

            <a
              href={`https://wa.me/${whatsapp}?text=Olá, preciso de suporte no HC Connect.`}
              target="_blank"
              className="block text-center bg-blue-600 hover:bg-blue-500 transition rounded-2xl font-bold py-4"
            >
              Conversar
            </a>
          </div>

          <div className="border border-blue-900 rounded-2xl p-6 bg-[#071226]">
            <div className="text-4xl mb-4">📞</div>
            <h3 className="text-xl font-bold mb-2">Telefone</h3>
            <p className="text-slate-400 mb-6">{telefone}</p>

            <a
              href={`tel:+55${telefone}`}
              className="block text-center bg-blue-600 hover:bg-blue-500 transition rounded-2xl font-bold py-4"
            >
              Ligar agora
            </a>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-black">Meus chamados</h2>
            <p className="text-slate-400">
              Acompanhe o status dos seus chamados.
            </p>
          </div>

          <select className="max-w-xs">
            <option>Todos os status</option>
            <option>Em aberto</option>
            <option>Em andamento</option>
            <option>Resolvido</option>
          </select>
        </div>

        <p className="text-slate-400">
          Nenhum chamado aberto.
        </p>
      </section>
    </main>
  )
}