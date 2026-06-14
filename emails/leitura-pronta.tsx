import { Text, Section } from '@react-email/components'
import { Layout } from './components/Layout'
import { Botao } from './components/Botao'

interface Props {
  nome: string
  siteUrl: string
  consultationId: string
}

export function EmailLeituraPronta({ nome, siteUrl, consultationId }: Props) {
  return (
    <Layout preview="Sua análise está pronta! ✨">
      <Text style={titulo}>Sua análise está pronta, {nome}! ✨</Text>
      <Text style={texto}>
        A especialista preparou sua análise com muito cuidado e atenção.
        Ela já está disponível na plataforma.
      </Text>
      <Text style={texto}>
        Clique abaixo para ver sua análise completa:
      </Text>
      <Section style={{ textAlign: 'center' }}>
        <Botao href={`${siteUrl}/dashboard/leitura/${consultationId}`}>
          Ver minha análise agora
        </Botao>
      </Section>
      <Text style={rodape}>Com carinho,<br />Equipe ConsultaViva</Text>
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }