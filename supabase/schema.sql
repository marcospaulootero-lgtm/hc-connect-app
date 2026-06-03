CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  contato_principal text,
  email_principal text NOT NULL,
  telefone text,
  endereco text,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE public.perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  tipo_usuario text NOT NULL CHECK (tipo_usuario IN ('admin', 'cliente')),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE public.embarques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  awb text NOT NULL UNIQUE,
  transportadora text NOT NULL,
  servico text NOT NULL,
  origem text NOT NULL,
  destino text NOT NULL,
  peso_real numeric(10,2),
  peso_taxado numeric(10,2),
  status_operacional text NOT NULL DEFAULT 'Processo cadastrado',
  previsao_entrega date,
  ultima_atualizacao timestamptz DEFAULT now(),
  observacao_cliente text,
  visivel_cliente boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE public.timeline_embarque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  status text NOT NULL,
  descricao text,
  data_hora timestamptz DEFAULT now(),
  criado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL
);

CREATE TABLE public.faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  numero_fatura text NOT NULL,
  valor numeric(12,2) NOT NULL,
  moeda text DEFAULT 'USD',
  vencimento date,
  data_pagamento date,
  status_financeiro text NOT NULL DEFAULT 'Em aberto',
  arquivo_pdf text,
  visivel_cliente boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  nome_arquivo text NOT NULL,
  arquivo_url text NOT NULL,
  visivel_cliente boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE public.mensagens_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  embarque_id uuid REFERENCES public.embarques(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  assunto text NOT NULL,
  mensagem text NOT NULL,
  status text DEFAULT 'Aberto',
  criado_em timestamptz DEFAULT now(),
  respondido_em timestamptz
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_embarque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_suporte ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.usuario_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND tipo_usuario = 'admin' AND ativo = true);
$$;

CREATE OR REPLACE FUNCTION public.empresa_usuario()
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT empresa_id FROM public.perfis WHERE id = auth.uid() AND ativo = true LIMIT 1;
$$;

CREATE POLICY "empresas_select" ON public.empresas FOR SELECT USING (public.usuario_admin() OR id = public.empresa_usuario());
CREATE POLICY "empresas_admin_all" ON public.empresas FOR ALL USING (public.usuario_admin()) WITH CHECK (public.usuario_admin());

CREATE POLICY "perfis_select" ON public.perfis FOR SELECT USING (id = auth.uid() OR public.usuario_admin());
CREATE POLICY "perfis_admin_all" ON public.perfis FOR ALL USING (public.usuario_admin()) WITH CHECK (public.usuario_admin());

CREATE POLICY "embarques_select" ON public.embarques FOR SELECT USING (public.usuario_admin() OR (empresa_id = public.empresa_usuario() AND visivel_cliente = true));
CREATE POLICY "embarques_admin_all" ON public.embarques FOR ALL USING (public.usuario_admin()) WITH CHECK (public.usuario_admin());

CREATE POLICY "timeline_select" ON public.timeline_embarque FOR SELECT USING (public.usuario_admin() OR EXISTS (SELECT 1 FROM public.embarques e WHERE e.id = timeline_embarque.embarque_id AND e.empresa_id = public.empresa_usuario() AND e.visivel_cliente = true));
CREATE POLICY "timeline_admin_all" ON public.timeline_embarque FOR ALL USING (public.usuario_admin()) WITH CHECK (public.usuario_admin());

CREATE POLICY "faturas_select" ON public.faturas FOR SELECT USING (public.usuario_admin() OR (visivel_cliente = true AND EXISTS (SELECT 1 FROM public.embarques e WHERE e.id = faturas.embarque_id AND e.empresa_id = public.empresa_usuario() AND e.visivel_cliente = true)));
CREATE POLICY "faturas_admin_all" ON public.faturas FOR ALL USING (public.usuario_admin()) WITH CHECK (public.usuario_admin());

CREATE POLICY "documentos_select" ON public.documentos FOR SELECT USING (public.usuario_admin() OR (visivel_cliente = true AND EXISTS (SELECT 1 FROM public.embarques e WHERE e.id = documentos.embarque_id AND e.empresa_id = public.empresa_usuario() AND e.visivel_cliente = true)));
CREATE POLICY "documentos_admin_all" ON public.documentos FOR ALL USING (public.usuario_admin()) WITH CHECK (public.usuario_admin());

CREATE POLICY "suporte_select" ON public.mensagens_suporte FOR SELECT USING (public.usuario_admin() OR empresa_id = public.empresa_usuario());
CREATE POLICY "suporte_cliente_insert" ON public.mensagens_suporte FOR INSERT WITH CHECK (empresa_id = public.empresa_usuario());
CREATE POLICY "suporte_admin_all" ON public.mensagens_suporte FOR ALL USING (public.usuario_admin()) WITH CHECK (public.usuario_admin());
