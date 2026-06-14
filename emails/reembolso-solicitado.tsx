import { Text } from '@react-email/components'
import { Layout } from './components/Layout'

interface Props {
  nomeCliente: string
  valor: string  // ex: "R$ 100,00"
}

export function EmailReembolsoSolicitado({ nomeCliente, valor }: Props) {
  return (
    <Layout preview="Nova solicitação de reembolso">
      <Text style={titulo}>Nova solicitação de reembolso</Text>
      <Text style={texto}>
        A cliente <strong>{nomeCliente}</strong> solicitou o reembolso de <strong>{valor}</strong>.
      </Text>
      <Text style={texto}>
        Acesse o painel, aba <strong>Reembolsos</strong>, para processar manualmente no Mercado Pago.
        O prazo é de <strong>48 horas úteis</strong>.
      </Text>
      <Text style={rodape}>Equipe ConsultaViva</Text>
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }