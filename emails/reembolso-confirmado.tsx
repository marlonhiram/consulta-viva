import { Text } from '@react-email/components'
import { Layout } from './components/Layout'

interface Props { nome: string; valor: string }

export function EmailReembolsoConfirmado({ nome, valor }: Props) {
  return (
    <Layout preview="Seu reembolso foi processado ✅">
      <Text style={titulo}>Reembolso confirmado! ✅</Text>
      <Text style={texto}>
        Olá, {nome}! O reembolso de <strong>{valor}</strong> foi processado com sucesso.
      </Text>
      <Text style={texto}>
        O valor será creditado no seu Pix em até <strong>1 a 3 dias úteis</strong>,
        dependendo do seu banco.
      </Text>
      <Text style={rodape}>Com carinho,<br />Equipe ConsultaViva</Text>
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }