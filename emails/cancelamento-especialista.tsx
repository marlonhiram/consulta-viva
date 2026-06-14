import { Text, Section } from '@react-email/components'
import { Layout } from './components/Layout'
import { Botao } from './components/Botao'

interface Props {
  nome: string
  dataHora: string
  motivo: string
  siteUrl: string
}

export function EmailCancelamentoEspecialista({ nome, dataHora, motivo, siteUrl }: Props) {
  return (
    <Layout preview="Sua consulta foi cancelada">
      <Text style={titulo}>Sua consulta foi cancelada</Text>
      <Text style={texto}>
        Olá, {nome}. Infelizmente sua consulta agendada para <strong>{dataHora}</strong> precisou ser cancelada pela especialista.
      </Text>
      <Text style={texto}><strong>Motivo:</strong> {motivo}</Text>
      <Text style={texto}>
        Não se preocupe! Um <strong>crédito de R$ 100,00</strong> foi adicionado automaticamente à sua conta
        e pode ser usado para agendar uma nova consulta quando quiser.
      </Text>
      <Section style={{ textAlign: 'center' }}>
        <Botao href={`${siteUrl}/dashboard`}>Agendar nova consulta</Botao>
      </Section>
      <Text style={rodape}>Com carinho,<br />Equipe ConsultaViva</Text>
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }