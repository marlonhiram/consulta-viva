import { Text, Section } from '@react-email/components'
import { Layout } from './components/Layout'
import { Botao } from './components/Botao'

interface Props {
  nome: string
  dataHora: string   // ex: "Sexta, 02 de maio às 14h30"
  siteUrl: string
  consultationId: string
  isEspecialista?: boolean
  nomeCliente?: string
}

export function EmailConsultaAgendada({
  nome, dataHora, siteUrl, consultationId, isEspecialista, nomeCliente
}: Props) {
  return (
    <Layout preview={`Consulta confirmada para ${dataHora} ✅`}>
      <Text style={titulo}>Consulta confirmada! ✅</Text>

      {isEspecialista ? (
        <Text style={texto}>
          Uma nova consulta foi agendada com a cliente <strong>{nomeCliente}</strong>.
        </Text>
      ) : (
        <Text style={texto}>
          Ótima notícia, {nome}! Sua consulta premium foi agendada com sucesso.
        </Text>
      )}

      <Section style={destaque}>
        <Text style={destaqueTexto}>📅 {dataHora}</Text>
      </Section>

      <Text style={texto}>
        Fique atento(a) ao horário — o acesso à sala de chat abre <strong>5 minutos antes</strong> da consulta.
      </Text>

      <Section style={{ textAlign: 'center' }}>
        <Botao href={`${siteUrl}/dashboard`}>
          {isEspecialista ? 'Ver painel' : 'Ver minha consulta'}
        </Botao>
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