import { Text } from '@react-email/components'
import { Layout } from './components/Layout'

interface Props {
  nomeEspecialista: string  // para o e-mail que vai para a especialista
  nomeCliente: string
  dataHora: string
}

export function EmailCancelamentoCliente({ nomeEspecialista, nomeCliente, dataHora }: Props) {
  return (
    <Layout preview="Consulta cancelada pelo cliente">
      <Text style={titulo}>Consulta cancelada</Text>
      <Text style={texto}>
        Olá! A cliente <strong>{nomeCliente}</strong> cancelou a consulta que estava agendada para:
      </Text>
      <Text style={destaque}>📅 {dataHora}</Text>
      <Text style={texto}>
        O crédito foi devolvido automaticamente para a cliente e o horário já está disponível na agenda.
      </Text>
      <Text style={rodape}>Equipe ConsultaViva</Text>
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const destaque = { fontSize: '16px', color: '#2c1810', fontWeight: 'bold', backgroundColor: '#faf3e8', padding: '12px 16px', borderRadius: '4px', margin: '8px 0 16px' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }