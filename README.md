# HC Connect

Portal web para clientes da HC Consultoria acompanharem embarques, faturas, documentos e status.

## O que já vem pronto

- Login com Supabase Auth
- Área do cliente
- Área administrativa HC
- Cadastro de clientes
- Cadastro de embarques
- Atualização de status com timeline automática
- Cadastro de faturas
- Visualização de documentos por link
- Suporte/chamados
- Segurança RLS: cliente só vê os dados da própria empresa

## Instalação

1. Crie um projeto no Supabase.
2. Copie o conteúdo de `supabase/schema.sql` e rode no SQL Editor do Supabase.
3. Crie um arquivo `.env.local` usando o modelo `.env.example`.
4. Instale as dependências:

```bash
npm install
```

5. Rode localmente:

```bash
npm run dev
```

6. Acesse:

```bash
http://localhost:3000
```

## Criar primeiro admin

1. No Supabase, vá em Authentication > Users.
2. Crie um usuário com seu e-mail.
3. Copie o ID do usuário.
4. Rode no SQL Editor:

```sql
insert into public.perfis (id, nome, email, tipo_usuario, ativo)
values ('COLE_AQUI_O_ID_DO_USUARIO', 'Marcos Paulo', 'marcos@hcbhz.com', 'admin', true);
```

## Criar cliente com login

1. Cadastre a empresa na tela Admin > Clientes.
2. Crie o usuário do cliente em Authentication > Users.
3. Copie o ID do usuário e o ID da empresa.
4. Rode:

```sql
insert into public.perfis (id, nome, email, tipo_usuario, empresa_id, ativo)
values ('ID_DO_USUARIO_CLIENTE', 'Nome Cliente', 'email@cliente.com', 'cliente', 'ID_DA_EMPRESA', true);
```

## Publicar online

Recomendado: Vercel.

1. Suba o projeto para GitHub.
2. Importe na Vercel.
3. Configure as variáveis:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Publique.

Sugestão de domínio: `connect.hcbhz.com`.

## Próximas melhorias

- Upload real de PDF direto no Supabase Storage
- Botão de suporte na área do cliente
- Notificações por e-mail ao atualizar status
- Importação de planilha Excel da HC
- Integração DHL/FedEx
