# ConsultaViva

> **Deploy:** [project-bijz1.vercel.app](https://project-bijz1.vercel.app)

Plataforma SaaS fullstack para consultorias comportamentais online. O cliente passa por uma triagem assistida por IA, envia uma foto para avaliação, realiza o pagamento via PIX e entra em uma sessão de chat ao vivo com a especialista — tudo dentro da plataforma, sem sair para WhatsApp ou terceiros.

Projeto desenvolvido para explorar integrações reais de IA generativa, pagamentos, realtime, e-mail transacional e dashboard administrativo completo.

## Status

| Integração | Status |
|-----------|--------|
| Supabase Auth + Database | ✅ Funcionando |
| Triagem IA (Google Gemini 2.5 Flash) | ✅ Funcionando |
| Upload de foto de rosto | ✅ Funcionando |
| Pagamento PIX (Mercado Pago) | ✅ Funcionando |
| Webhook Mercado Pago (crédito automático) | ✅ Funcionando |
| E-mails transacionais (Resend) | ✅ Funcionando |
| Painel administrativo | ✅ Funcionando |
| Chat ao vivo | ✅ Funcionando |
| Deploy (Vercel) | ✅ Funcionando |

---

## Funcionalidades

**Fluxo do cliente**
- Landing page responsiva (mobile-first) com CTA e depoimentos em bottom sheet animado
- Cadastro e autenticação via Supabase Auth
- Triagem assistida por IA (Google Gemini) com fluxo multi-etapa controlado por tokens
- Upload de foto frontal do rosto diretamente na conversa com o chatbot
- Consulta Avaliativa gratuita escrita pela especialista com visualização formatada
- Pagamento via PIX com QR Code e confirmação automática via Supabase Realtime
- Agendamento de sessão premium com seleção de horários disponíveis
- Chat ao vivo com janela de acesso controlada no servidor (5 min antes até 35 min após)
- Sistema de créditos: gerado automaticamente no pagamento, usado no agendamento
- Cancelamento com crédito proporcional e solicitação de reembolso em dinheiro
- Histórico de consultas com acesso às avaliações anteriores

**Painel administrativo** *(desktop-only)*
- Fila de solicitações com visualização de fotos e zoom via `react-zoom-pan-pinch`
- Aprovação direta ou recusa de materiais com motivo notificado ao cliente por e-mail
- Agenda com visualização de consultas agendadas e bloqueios manuais
- Editor para envio da avaliação escrita ao cliente
- Gerenciamento de reembolsos (solicitação → aprovação → confirmação)

**E-mails transacionais** *(templates em React Email)*
- Boas-vindas
- Triagem recebida
- Consulta agendada (versão cliente e versão especialista)
- Lembrete 24h antes da consulta (via Cron)
- Avaliação pronta
- Materiais recusados com motivo
- Cancelamento pelo cliente e pela especialista
- Reembolso solicitado e reembolso confirmado

**Automações**
- Webhook do Mercado Pago para confirmação de pagamento e geração de crédito automática
- Cron job diário para lembretes de consulta (Vercel Cron + `CRON_SECRET`)
- Trigger no Supabase para criação de perfil ao registrar novo usuário

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Linguagem | TypeScript 5 |
| Banco de dados | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| IA | Google Gemini 2.5 Flash |
| Pagamentos | Mercado Pago (PIX) |
| E-mail | Resend + React Email |
| Estilização | Tailwind CSS 4 + CSS Modules |
| Deploy | Vercel |

---

## Arquitetura

```
app/
├── page.tsx                            # Landing page (Server Component)
├── LandingClient.tsx                   # Landing interativa com sheet de depoimentos
├── layout.tsx                          # Root layout global
├── globals.css / landing.css           # Estilos globais e da landing
│
├── cadastro/                           # Login e registro
│   ├── page.tsx                        # Server Component — redireciona se autenticado
│   └── CadastroClient.tsx              # Formulário de cadastro/login com tabs
│
├── dashboard/                          # Área autenticada do cliente
│   ├── page.tsx                        # Server Component — busca dados e passa via props
│   ├── DashboardClient.tsx             # Hub central com todos os estados da consulta
│   ├── helpers.ts                      # Utilitários de data, saudação e labels
│   ├── types.ts                        # Tipos compartilhados (Consultation, Credit, Props)
│   ├── politicas-data.ts               # Textos estáticos das políticas e conformidade
│   ├── components/
│   │   ├── LogoutBtn.tsx               # Botão de logout isolado (client component)
│   │   └── modals/
│   │       ├── ModalPerfil.tsx         # Edição de nome e dados pessoais
│   │       ├── ModalPix.tsx            # Geração e exibição de QR Code PIX
│   │       ├── ModalPolitica.tsx       # Exibição das políticas em sheet
│   │       └── ModalCancelarConsulta.tsx # Confirmação de cancelamento
│   ├── triagem/                        # Chatbot de triagem com Gemini + upload de foto
│   │   ├── page.tsx                    # Server Component — cria/recupera consulta em triagem
│   │   └── TriagemClient.tsx           # Chat multi-etapa, upload de foto de rosto, tokens
│   ├── triagem-retornante/             # Reenvio de materiais (cliente recorrente)
│   ├── agendar/[id]/                   # Seleção de horário disponível
│   ├── chat/[id]/                      # Sala de consulta ao vivo
│   │   ├── page.tsx                    # Server Component — valida acesso e carrega dados
│   │   ├── ChatWrapper.tsx             # Wrapper com Suspense
│   │   └── ChatClient.tsx              # Interface de chat em tempo real
│   └── leitura/[id]/                   # Exibição da avaliação escrita
│       ├── page.tsx                    # Server Component — busca avaliação e créditos
│       └── LeituraClient.tsx           # Exibição formatada da avaliação com CTA premium
│
├── admin/                              # Painel da especialista (desktop-only)
│   ├── page.tsx                        # Server Component — protegido por role admin
│   ├── AdminClient.tsx                 # Orquestrador das abas e totalizadores
│   ├── helpers.ts                      # Cálculo de SLA e badges de prazo
│   ├── types.ts                        # Tipos internos do painel (Tab, MockConsultation)
│   ├── components/
│   │   ├── WorkView.tsx                # Tela de trabalho: foto, prancheta, ações
│   │   ├── tabs/
│   │   │   ├── SolicitacoesTab.tsx     # Lista de consultas aguardando avaliação
│   │   │   ├── RealizadasTab.tsx       # Consultas já concluídas
│   │   │   ├── AgendaTab.tsx           # Calendário de agendamentos e bloqueios
│   │   │   └── ReembolsosTab.tsx       # Fila de solicitações de reembolso
│   │   └── modals/
│   │       ├── RefuseModal.tsx         # Modal para recusar fotos com motivo
│   │       ├── CancelModal.tsx         # Modal para cancelar consulta com motivo
│   │       └── BlockModal.tsx          # Modal para bloquear horário na agenda
│   ├── consultas/route.ts              # Busca solicitações e realizadas para o painel
│   ├── enviar-leitura/route.tsx        # Salva avaliação e notifica cliente por e-mail
│   ├── recusar-fotos/route.ts          # Recusa materiais e notifica cliente
│   ├── cancelar-consulta/route.tsx     # Cancela consulta e gera crédito
│   ├── marcar-reembolso/route.tsx      # Confirma reembolso processado
│   └── atendimento/[id]/page.tsx       # Redirect para WorkView via ID
│
└── api/
    ├── ai-triagem/route.tsx            # Chat Gemini — 4 etapas com tokens; upload de foto
    ├── pagamento/criar-pix/route.ts    # Geração de QR Code via Mercado Pago
    ├── webhooks/mercadopago/route.ts   # Confirmação de pagamento + crédito automático
    ├── available-slots/route.ts        # Horários disponíveis para agendamento
    ├── agendar-consulta/route.tsx      # Criação do agendamento com uso de crédito
    ├── chat/
    │   ├── enviar-mensagem/route.ts    # Envio de mensagens com controle de janela de tempo
    │   └── encerrar/route.ts           # Encerramento da sessão de chat
    ├── cron/lembrete-consulta/route.tsx # Job agendado de lembretes (Vercel Cron)
    ├── solicitar-reembolso/route.tsx   # Solicitação de reembolso pelo cliente
    ├── cancelar-consulta-cliente/route.tsx # Cancelamento pelo cliente com crédito
    ├── cancelar-cadastro/route.ts      # Exclusão de conta via token de e-mail
    ├── enviar-boas-vindas/route.tsx    # Disparo de e-mail de boas-vindas pós-cadastro
    ├── retornante/route.ts             # Cria nova consulta para cliente recorrente
    ├── salvar-perfil/route.ts          # Atualização de dados do perfil
    └── promo/perfil/route.tsx          # Rota de perfil para fluxo alternativo

lib/
├── supabase.ts                         # Cliente browser (anon key)
├── supabase-server.ts                  # Cliente SSR com cookies
├── supabase-admin.ts                   # Service role — bypass RLS (rotas protegidas)
├── supabase-middleware.ts              # Middleware de autenticação para o App Router
├── email.ts                            # Integração Resend — função sendEmail()
├── validation.ts                       # Schemas Zod para todas as rotas de API
├── constants.ts                        # Valores globais (preço, URL do site)
└── utils.ts                            # Funções utilitárias (getInitials, etc.)

emails/
├── components/
│   ├── Layout.tsx                      # Template base compartilhado por todos os e-mails
│   └── Botao.tsx                       # Componente de botão reutilizável
├── boas-vindas.tsx                     # E-mail pós-cadastro
├── triagem-recebida.tsx                # Confirmação de triagem enviada
├── leitura-pronta.tsx                  # Avaliação disponível no dashboard
├── consulta-agendada.tsx               # Confirmação de agendamento (cliente)
├── lembrete-consulta.tsx               # Lembrete 24h antes
├── cancelamento-cliente.tsx            # Cancelamento feito pelo cliente
├── cancelamento-especialista.tsx       # Cancelamento feito pela especialista
├── reembolso-solicitado.tsx            # Reembolso em processamento
└── reembolso-confirmado.tsx            # Reembolso concluído

supabase/
├── config.toml                         # Configuração do projeto Supabase local
└── migrations/
    ├── 20260616192655_remote_schema.sql # Schema completo capturado do banco remoto
    └── 20260617000000_add_rosto_hand_type.sql # Adiciona 'rosto' ao enum hand_type_enum
```

---

## Fluxo principal

```
[Landing] → Cadastro → Triagem IA (Gemini 4 etapas) → Upload foto de rosto
         │
         └─→ Especialista avalia no painel admin
                   │
                   ├─→ Recusa materiais → Cliente reenvia → loop
                   │
                   └─→ Envia avaliação → Cliente notificado por e-mail
                             │
                             ├─→ [Consulta Avaliativa concluída]
                             │       └─→ CTA consulta premium
                             │
                             └─→ PIX (Mercado Pago) → Webhook → Crédito gerado
                                       └─→ Agendamento → Chat ao vivo (30 min)
                                                 └─→ Avaliação premium entregue
```

---

## Banco de dados (principais tabelas)

| Tabela | Função |
|--------|--------|
| `profiles` | Dados do cliente (nome, e-mail, data de nascimento, telefone) |
| `consultations` | Ciclo de vida da consulta — status, tipo, agendamento, avaliação |
| `messages` | Histórico completo: triagem IA + chat ao vivo |
| `photos` | Arquivos enviados pelo cliente (referência ao Supabase Storage) |
| `payments` | Pagamentos PIX com status sincronizado via webhook |
| `credits` | Créditos disponíveis, usados ou reembolsados |
| `available_slots` | Grade de horários da especialista |

---

## Rodando localmente

```bash
npm install
npm run dev
```

Crie um arquivo `.env.local` com as seguintes variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_SITE_URL=http://localhost:3000

GEMINI_API_KEY=
MP_ACCESS_TOKEN=
RESEND_API_KEY=

CRON_SECRET=
```

> O banco de dados requer as tabelas descritas acima com as políticas de RLS configuradas. As consultas com `supabase-admin.ts` (service role) bypassam RLS e são usadas apenas em rotas de API protegidas por autenticação.

---

## Destaques técnicos

- **Separação Server/Client Components** — páginas são Server Components que buscam dados no banco e os passam via props para Client Components; zero fetch desnecessário no lado do cliente
- **Controle de acesso por RLS** — políticas no Supabase garantem isolamento total entre clientes; rotas admin usam service role com validação explícita de identidade antes de qualquer operação
- **Chat com janela de tempo no servidor** — a API valida o horário agendado antes de aceitar qualquer mensagem; o cliente não pode burlar abrindo o chat antes do horário
- **Webhook idempotente** — o endpoint do Mercado Pago sempre retorna 200 para evitar retentativas; a lógica de crédito é defensiva contra pagamentos duplicados
- **Fluxo de IA com estado por tokens** — o chatbot avança etapas detectando tokens especiais na resposta do Gemini (`ETAPA_FOTOS_ROSTO`, `TRIAGEM_CONCLUIDA`) sem precisar de metadados separados na API
- **Upload seguro via Service Role** — arquivos enviados pelo cliente chegam à API, são processados em buffer e sobem ao Supabase Storage com credenciais de servidor; nenhuma chave sensível é exposta ao browser
- **E-mails com React Email** — templates reutilizáveis com layout compartilhado, renderizados server-side e enviados via Resend com subjects e previews corretos para cada evento do ciclo
