import { Text, Section, Link } from '@react-email/components'
import { Layout } from './components/Layout'
import { Botao } from './components/Botao'

interface Props {
  nome: string
  siteUrl: string
  cancelToken?: string
}

export function EmailBoasVindas({ nome, siteUrl, cancelToken }: Props) {
  return (
    <Layout preview="Bem-vindo(a) à ConsultaViva 🌿">
      <Text style={titulo}>Que alegria ter você aqui, {nome}! 🌿</Text>
      <Text style={texto}>
        Seu cadastro na <strong>ConsultaViva</strong> foi realizado com sucesso.
        Estamos felizes em te acompanhar nessa jornada de autoconhecimento.
      </Text>
      <Text style={texto}>
        Você deu o primeiro passo — e estamos aqui para te acompanhar com toda atenção e cuidado.
      </Text>
      <Section style={{ textAlign: 'center' }}>
        <Botao href={`${siteUrl}/dashboard`}>Receber minha análise gratuita</Botao>
      </Section>
      <Text style={rodape}>Com carinho,<br />Equipe ConsultaViva</Text>

      {cancelToken && (
        <Section style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
          <Text style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>
            Não foi você que criou essa conta?{' '}
            <Link href={`${siteUrl}/api/cancelar-cadastro?token=${cancelToken}`}>
              Clique aqui para cancelar o cadastro.
            </Link>
          </Text>
        </Section>
      )}
    </Layout>
  )
}

const titulo = { fontSize: '20px', color: '#2c1810', fontWeight: 'bold', margin: '0 0 16px' }
const texto  = { fontSize: '15px', color: '#4a3728', lineHeight: '1.7', margin: '0 0 12px' }
const rodape = { fontSize: '14px', color: '#8a7a6e', marginTop: '24px' }