# ConsultaViva

Plataforma SaaS fullstack para consultorias especializadas online. O cliente passa por uma triagem assistida por IA, envia materiais para análise, realiza o pagamento via PIX e entra em uma sessão de chat ao vivo com o especialista — tudo dentro da plataforma, sem sair para WhatsApp ou terceiros.

Projeto desenvolvido para explorar integrações reais de IA generativa, pagamentos, realtime, e-mail transacional e dashboard administrativo completo.

---

## Funcionalidades

**Fluxo do cliente**
- Landing page responsiva (mobile-first) com CTA e depoimentos em bottom sheet animado
- Página de promoção alternativa (`/promocao`) com contagem de vagas em tempo real
- Cadastro com validação de CPF (anti-fraude) e token de cancelamento por e-mail
- Triagem assistida por IA (Google Gemini) com fluxo multi-etapa controlado por tokens
- Upload de arquivos para análise diretamente na conversa com o chatbot
- Análise gratuita escrita pelo especialista com visualização formatada
- Pagamento via PIX com QR Code e confirmação automática via Supabase Realtime
- Agendamento de sessão premium com seleção de horários disponíveis
- Chat ao vivo com janela de acesso controlada no servidor (5 min antes até 35 min após)
- Sistema de créditos: gerado automaticamente no pagamento, usado no agendamento
- Cancelamento com crédito proporcional e solicitação de reembolso em dinheiro
- Histórico de consultas com acesso às análises anteriores

**Painel administrativo** *(desktop-only)*
- Fila de solicitações com visualização de arquivos e zoom via `react-zoom-pan-pinch`
- Aprovação direta ou recusa de materiais com motivo notificado ao cliente por e-mail
- Agenda com visualização de consultas agendadas e bloqueios manuais
- Editor para envio da análise escrita ao cliente
- Gerenciamento de reembolsos (solicitação → aprovação → confirmação)

**E-mails transacionais** *(11 templates em React Email)*
- Boas-vindas com token de cancelamento de cadastro
- Triagem recebida
- Consulta agendada (versão cliente e versão especialista)
- Lembrete 24h antes da consulta (via Cron)
- Análise pronta
- Materiais recusados com motivo
- Cancelamento pelo cliente e pela especialista
- Reembolso solicitado e reembolso confirmado

**Automações**
- Webhook do Mercado Pago para confirmação de pagamento e geração de crédito automática
- Cron job diário para lembretes de consulta (Vercel Cron + `CRON_SECRET`)
- Trigger no Supabase para criação de perfil ao registrar novo usuário
- Atualização de vagas de promoção em tempo real

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
├── page.tsx                      # Landing page (Server Component)
├── promocao/                     # Página de promoção com cadastro integrado
├── cadastro/                     # Login e registro padrão
├── dashboard/                    # Área autenticada do cliente
│   ├── DashboardClient.tsx       # Hub central com todos os estados da consulta
│   ├── triagem/                  # Chatbot de triagem com Gemini + upload
│   ├── triagem-retornante/       # Reenvio de materiais (cliente recorrente)
│   ├── agendar/[id]/             # Seleção de horário disponível
│   ├── chat/[id]/                # Sala de consulta ao vivo
│   └── leitura/[id]/             # Exibição da análise escrita
├── admin/                        # Painel do especialista (desktop-only)
└── api/
    ├── ai-triagem/               # Chat Gemini com fluxo multi-etapa e tokens
    ├── pagamento/criar-pix/      # Geração de QR Code via Mercado Pago
    ├── webhooks/mercadopago/     # Confirmação de pagamento + crédito automático
    ├── available-slots/          # Horários disponíveis para agendamento
    ├── agendar-consulta/         # Criação do agendamento com uso de crédito
    ├── chat/                     # Envio de mensagens com controle de janela de tempo
    ├── cron/lembrete-consulta/   # Job agendado de lembretes (Vercel Cron)
    ├── solicitar-reembolso/      # Solicitação pelo cliente
    ├── validate-cpf/             # Validação de CPF único (anti-fraude)
    └── admin/                    # Rotas exclusivas do painel administrativo

lib/
├── supabase.ts                   # Cliente browser
├── supabase-server.ts            # Cliente SSR (cookies)
├── supabase-admin.ts             # Service role (bypass RLS)
└── email.ts                      # Integração Resend

emails/                           # 11 templates React Email
```

---

## Fluxo principal

```
[Landing / Promo] → Cadastro → Triagem IA (Gemini 4 etapas) → Upload de materiais
         │
         └─→ Especialista analisa no painel admin
                   │
                   ├─→ Recusa materiais → Cliente reenvio → loop
                   │
                   └─→ Envia análise → Cliente notificado por e-mail
                             │
                             ├─→ [Análise gratuita concluída]
                             │       └─→ CTA consulta premium
                             │
                             └─→ PIX (Mercado Pago) → Webhook → Crédito gerado
                                       └─→ Agendamento → Chat ao vivo (30 min)
                                                 └─→ Análise premium entregue
```

---

## Banco de dados (principais tabelas)

| Tabela | Função |
|--------|--------|
| `profiles` | Dados do cliente (nome, CPF, lateralidade, telefone) |
| `consultations` | Ciclo de vida da consulta — status, tipo, agendamento, análise |
| `messages` | Histórico completo: triagem IA + chat ao vivo |
| `photos` | Arquivos enviados pelo cliente (referência ao Supabase Storage) |
| `payments` | Pagamentos PIX com status sincronizado via webhook |
| `credits` | Créditos disponíveis, usados ou reembolsados |
| `available_slots` | Grade de horários da especialista |
| `promocoes` | Promoções ativas com controle de vagas e validade |

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

> O banco de dados requer as tabelas descritas acima com as políticas de RLS configuradas. As consultas com `supabase-admin.ts` (service role) bypassam RLS e são usadas apenas em rotas de API protegidas.

---

## Destaques técnicos

- **Separação Server/Client Components** — páginas são Server Components que buscam dados no banco e os passam via props para Client Components; zero fetch desnecessário no lado do cliente
- **Controle de acesso por RLS** — políticas no Supabase garantem isolamento total entre clientes; rotas admin usam service role com validação própria de identidade
- **Chat com janela de tempo no servidor** — a API valida o horário agendado antes de aceitar qualquer mensagem; o cliente não pode burlar abrindo o chat antes do horário
- **Webhook idempotente** — o endpoint do Mercado Pago sempre retorna 200 para evitar retentativas; a lógica de crédito é defensiva contra pagamentos duplicados
- **Fluxo de IA com estado por tokens** — o chatbot avança etapas detectando tokens especiais na resposta do Gemini (`ETAPA_FOTOS_DESTRO`, `TRIAGEM_CONCLUIDA`, etc.) sem precisar de metadados separados na API
- **Upload seguro via Service Role** — arquivos enviados pelo cliente chegam à API, são processados em buffer e sobem ao Supabase Storage com credenciais de servidor; nenhuma chave sensível é exposta ao browser
- **E-mails com React Email** — templates reutilizáveis com layout compartilhado, renderizados server-side e enviados via Resend com subjects e previews corretos para cada evento do ciclo
