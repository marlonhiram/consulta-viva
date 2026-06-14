import { Text, Section } from '@react-email/components'
import { Layout } from './components/Layout'
import { Botao } from './components/Botao'

interface Props {
  nome: string
  dataHora: string
  siteUrl: string
}

export function EmailLembreteConsulta({ nome, dataHora, siteUrl }: Props) {
  return (
    <Layout preview={`Lembrete: sua consulta é amanhã! 🌿`}>
      <Text style={titulo}>Sua consulta é amanhã! 🌿</Text>
      <Text style={texto}>
        Olá, {nome}! Passando para lembrar que sua consulta premium está agendada para:
      </Text>
      <Section style={destaque}>
        <Text style={destaqueTexto}>📅 {dataHora}</Text>
      </Section>
      <Text style={texto}>
        O acesso ao chat abre <strong>5 minutos antes</strong> do horário marcado.
        Esteja em um lugar tranquilo e com boa conexão. 💛
      </Text>
      <Section style={{ textAlign: 'center' }}>
        <Botao href={`${siteUrl}/dashboard`}>Ver minha consulta</Botao>
      </Section>
      <Text style={rodape}>Com carinho,<br />Equipe ConsultaViva</Text>
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const destaque = { backgroundColor: '#faf3e8', borderLeft: '4px solid #c9a96e', padding: '12px 16px', margin: '16px 0', borderRadius: '4px' }
const destaqueTexto = { fontSize: '17px', color: '#2c1810', fontWeight: 'bold', margin: '0' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }