import { Text } from '@react-email/components'
import { Layout } from './components/Layout'

interface Props { nome: string }

export function EmailTriagemRecebida({ nome }: Props) {
  return (
    <Layout preview="Seus materiais foram recebidos! ✨">
      <Text style={titulo}>Recebemos seus materiais, {nome}! ✨</Text>
      <Text style={texto}>
        Sua triagem chegou até nós e já está na fila para análise da especialista.
      </Text>
      <Text style={texto}>
        O prazo para receber sua análise gratuita é de <strong>até 48 horas</strong>.
        Você receberá um e-mail assim que estiver pronta.
      </Text>
      <Text style={texto}>
        Enquanto isso, que tal respirar fundo e confiar no processo? 🌿
      </Text>
      <Text style={rodape}>Com carinho,<br />Equipe ConsultaViva</Text>
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }