import { VALOR_CONSULTA_FORMATADO } from '@/lib/constants'
import type { Politica } from './types'

/**
 * Conteúdo estático exibido no painel "Informações e Conformidade" do dashboard.
 * Textos de caráter contratual/legal — qualquer alteração de valor deve vir
 * de `VALOR_CONSULTA_FORMATADO`, nunca hardcoded.
 */
export const POLITICAS: Politica[] = [
  {
    id: 'cancelamento',
    titulo: 'Política de Cancelamento',
    icone: '◎',
    conteudo: `Consultas agendadas podem ser canceladas pelo cliente com até 24 horas de antecedência em relação ao horário marcado. Cancelamentos realizados dentro deste prazo gerarão automaticamente um crédito no valor integral da consulta (${VALOR_CONSULTA_FORMATADO}), disponível para uso em novo agendamento.

Cancelamentos solicitados com menos de 24 horas de antecedência não darão direito a crédito ou reembolso, exceto em casos de força maior devidamente comprovados, a critério exclusivo da especialista.

A especialista reserva o direito de cancelar ou reagendar consultas em casos de imprevistos, notificando o cliente com a maior antecedência possível. Nestes casos, o crédito será restituído integralmente.`,
  },
  {
    id: 'reembolso',
    titulo: 'Política de Reembolso',
    icone: '◈',
    conteudo: `O cliente pode solicitar o reembolso em dinheiro do crédito disponível a qualquer momento, desde que o crédito não tenha sido utilizado para agendamento.

Os reembolsos são processados manualmente em até 48 horas úteis após a solicitação, via transferência bancária ou PIX para os dados informados pelo cliente.

Ao solicitar o reembolso, o cliente receberá uma confirmação por e-mail com o protocolo da solicitação. Após a conclusão, um novo e-mail de confirmação será enviado.

Créditos originados de cancelamentos realizados pelo cliente com menos de 24 horas de antecedência não são elegíveis a reembolso em dinheiro.`,
  },
  {
    id: 'isencao',
    titulo: 'Isenção de Responsabilidade',
    icone: '✦',
    conteudo: `A consultoria especializada é uma prática de análise e orientação pessoal, de caráter reflexivo e interpretativo. As análises realizadas pela especialista não constituem diagnóstico médico, psicológico, jurídico, financeiro ou de qualquer outra natureza técnica ou científica.

As interpretações fornecidas têm finalidade orientativa e reflexiva, e não devem substituir a consulta a profissionais habilitados nas respectivas áreas.

A especialista não se responsabiliza por decisões tomadas pelo cliente com base nas análises realizadas. O cliente declara estar ciente do caráter orientativo e não prescritivo da prática ao contratar o serviço.`,
  },
  {
    id: 'natureza',
    titulo: 'Natureza do Serviço',
    icone: '◇',
    conteudo: `ConsultaViva é uma plataforma de consultoria especializada que conecta clientes com especialistas experientes. Com mais de 30 anos de experiência, nossa especialista realiza análises profundas sobre aspectos da personalidade, tendências de vida, relacionamentos e potenciais individuais.

As análises são realizadas de forma estritamente confidencial, sendo de uso exclusivo do cliente. O conteúdo não é compartilhado com terceiros sem autorização expressa do titular.

Cada análise é única e personalizada, baseada na interpretação individual do perfil do cliente.`,
  },
  {
    id: 'lgpd',
    titulo: 'Proteção de Dados (LGPD)',
    icone: '⊡',
    conteudo: `Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), informamos:

Dados coletados: nome completo, e-mail, data de nascimento e materiais enviados para análise.

Finalidade: os dados são utilizados exclusivamente para a prestação do serviço de consultoria especializada e comunicação com o cliente.

Armazenamento: os dados são armazenados em servidores seguros e não são vendidos, cedidos ou compartilhados com terceiros para fins comerciais.

Retenção: os dados são mantidos pelo prazo necessário à prestação do serviço e por até 5 anos após o encerramento da relação, para fins de registro histórico e segurança jurídica.

Direitos do titular: o cliente pode solicitar a correção, exportação ou exclusão de seus dados a qualquer momento através dos canais de atendimento.`,
  },
  {
    id: 'termos',
    titulo: 'Termos de Uso',
    icone: '❖',
    conteudo: `Ao utilizar a plataforma ConsultaViva, o cliente concorda com os seguintes termos:

Elegibilidade: o serviço é destinado a maiores de 18 anos. O cadastro com dados falsos implica cancelamento imediato sem direito a reembolso.

Consulta Avaliativa: cada conta dá direito a uma única avaliação gratuita. Tentativas de burlar esta limitação resultarão em bloqueio da conta.

Conduta: o cliente deve tratar a especialista com respeito durante as consultas. Comportamentos abusivos resultarão no encerramento imediato da sessão sem reembolso.

Propriedade intelectual: as análises produzidas são de propriedade da especialista e do cliente, não podendo ser reproduzidas comercialmente sem autorização.

Modificações: estes termos podem ser atualizados a qualquer momento, com notificação prévia ao cliente cadastrado.`,
  },
]
