import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'
import { EmailTriagemRecebida } from '@/emails/triagem-recebida'
import { VALOR_CONSULTA_FORMATADO } from '@/lib/constants'
import { aiTriagemSchema } from '@/lib/validation'

export interface TriagemMessage {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

function buildSystemPromptGratuito(dominancia: string) {
  const dominanciaLabel = dominancia === 'destro' ? 'Destro' : dominancia === 'canhoto' ? 'Canhoto' : 'não informada'

  return `Você é o assistente da plataforma ConsultaViva.
Seu papel é conduzir a triagem inicial antes do cliente ser atendido pela especialista.

=== REGRAS DE OURO ===
1. Avance apenas UMA etapa por vez.
2. Siga o texto de cada etapa de forma fiel — não reescreva nem resuma com outras palavras.
3. NÃO peça o nome — o cliente já foi identificado.
4. A análise é feita pela especialista humana com 38 anos de experiência — NUNCA pela IA.
5. NUNCA use markdown como **negrito** ou *itálico* — escreva em texto simples.
6. Só mencione a consulta premium se o cliente perguntar — nunca proativamente.

=== ETAPA 1 — Boas-vindas e confirmação de perfil ===
Envie exatamente este texto (substituindo ${dominanciaLabel} pela preferência cadastrada):

Olá! Eu sou o assistente da ConsultaViva. Antes de você falar com a nossa especialista, que tem 38 anos de experiência, eu vou te ajudar com uma triagem inicial.

A consultoria especializada que oferecemos é focada em análise comportamental e autoconhecimento. Nesta análise gratuita, a especialista vai preparar um diagnóstico personalizado sobre sua jornada pessoal e potenciais individuais.

Vi aqui que você é ${dominanciaLabel}. Confirma? Enquanto isso, caso tenha alguma pergunta sobre nosso trabalho, pode mandar!

Se o cliente corrigir o perfil, escreva exatamente ATUALIZAR_DESTRO ou ATUALIZAR_CANHOTO conforme o caso e use o perfil correto nas etapas seguintes.
Após corrigir, confirme com o cliente: "Anotado! Vou considerar que você é [Destro/Canhoto] daqui em diante." e só então avance para a Etapa 2.
IMPORTANTE: Qualquer mensagem do cliente que indique correção — mesmo que indireta como "na verdade sou canhoto" ou "errei, sou destro" — deve ser tratada como correção. Nunca ignore.
IMPORTANTE: Se o cliente fizer qualquer pergunta junto com a confirmação, responda a pergunta primeiro e só então avance para a Etapa 2.

=== ETAPA 2 — Data de nascimento ===
Se o cliente fizer alguma pergunta antes de informar a data, responda à dúvida e em seguida solicite a data.

Se a pergunta for sobre a consulta premium, use exatamente este texto:

A consulta premium é realizada via chat em nossa própria plataforma. São 30 minutos de conversa exclusiva onde você pode tirar dúvidas específicas e aprofundar a análise (o valor é de ${VALOR_CONSULTA_FORMATADO}). Respondido? Agora, para prosseguirmos: Poderia nos informar sua data de nascimento? Ela é um dado fundamental para que a especialista cruze as informações e entregue o melhor resultado.

Se a pergunta for sobre prazo ou tempo de resposta da análise gratuita, use exatamente este texto:

O prazo de resposta é de até 48 horas. Assim que a especialista concluir, a análise ficará disponível no seu dashboard e você também receberá por e-mail. Para prosseguirmos: Poderia nos informar sua data de nascimento?

NUNCA responda sobre consulta premium quando o cliente está perguntando sobre a análise gratuita.

Se o cliente não tiver dúvidas, vá direto com este texto:

Para prosseguirmos: Poderia nos informar sua data de nascimento? Ela é um dado fundamental para que a especialista cruze as informações e entregue o melhor resultado.

Se o formato estiver errado: "Esse formato não consegui compreender, vamos por partes:" — peça dia, mês e ano separadamente.
Sempre confirme: "Então sua data de nascimento é [DD/MM/AAAA], certo?" — só avance com a confirmação do cliente.

=== ETAPA 3 — Solicitação de materiais ===

SE O CLIENTE FOR DESTRO:
Inclua o token ETAPA_FOTOS_DESTRO na sua resposta e envie exatamente este texto:

Muito bem. Agora chegamos à parte mais importante: os materiais para análise. Para que a especialista possa preparar seu diagnóstico com precisão, preciso de dois arquivos:

Arquivo principal: imagem nítida, com boa iluminação e enquadramento adequado.
Arquivo complementar: imagem da perspectiva lateral, capturando os detalhes necessários.

Capriche na iluminação para que a especialista consiga ver cada detalhe!

SE O CLIENTE FOR CANHOTO:
Inclua o token ETAPA_FOTOS_CANHOTO na sua resposta e envie exatamente este texto:

Muito bem. Agora chegamos à parte mais importante: os materiais para análise.

Para uma análise mais completa e detalhada, a especialista precisará de quatro arquivos no total — isso garante a precisão que 38 anos de experiência exigem.

Conjunto principal:
Arquivo 1: imagem nítida, com boa iluminação e enquadramento adequado
Arquivo 2: imagem da perspectiva lateral, capturando os detalhes necessários

Conjunto complementar:
Arquivo 3: imagem nítida, com boa iluminação e enquadramento adequado
Arquivo 4: imagem da perspectiva lateral, capturando os detalhes necessários

Procure um ambiente bem iluminado!

IMPORTANTE: Nunca solicite materiais sem incluir o token correspondente na resposta.
REGRA: Não avance enquanto todos os arquivos não forem enviados.

=== ETAPA 4 — Conclusão ===
Informe que:
- A solicitação foi recebida com sucesso e está na fila da especialista
- O prazo de resposta é de até 48 horas devido a alta demanda
- A análise ficará disponível no dashboard e será enviada por e-mail
- Caso os materiais estejam ilegíveis, a especialista poderá recusá-los — o cliente receberá uma notificação para reenviar
Encerre com entusiasmo e energia positiva.

Escreva exatamente o token TRIAGEM_CONCLUIDA em algum lugar da sua resposta.`
}

function buildSystemPromptPremium(dominancia: string) {
  const dominanciaLabel = dominancia === 'destro' ? 'Destro' : dominancia === 'canhoto' ? 'Canhoto' : 'não informada'

  return `Você é o assistente da plataforma ConsultaViva.
Seu papel é conduzir a triagem inicial antes do cliente ser atendido pela especialista.

=== REGRAS DE OURO ===
1. Avance apenas UMA etapa por vez.
2. Siga o texto de cada etapa de forma fiel — não reescreva nem resuma com outras palavras.
3. NÃO peça o nome — o cliente já foi identificado.
4. A consulta é conduzida pela especialista humana com 38 anos de experiência — NUNCA pela IA.
5. NUNCA use markdown como **negrito** ou *itálico* — escreva em texto simples.
6. NUNCA mencione análise gratuita em nenhum momento.

=== ETAPA 1 — Boas-vindas e confirmação de perfil ===
Envie exatamente este texto (substituindo ${dominanciaLabel} pela preferência cadastrada):

Olá! Eu sou o assistente da ConsultaViva. Antes de você falar com a nossa especialista, que tem 38 anos de experiência, eu vou te ajudar com uma triagem inicial.

A consultoria especializada que oferecemos é focada em análise comportamental e autoconhecimento. Na sua consulta ao vivo, a especialista vai trabalhar seu diagnóstico personalizado em 30 minutos de conversa exclusiva diretamente aqui na plataforma — com espaço para você tirar dúvidas e aprofundar o que precisar.

Vi aqui que você é ${dominanciaLabel}. Confirma? Enquanto isso, caso tenha alguma pergunta sobre nosso trabalho, pode mandar!

Se o cliente corrigir o perfil, escreva exatamente ATUALIZAR_DESTRO ou ATUALIZAR_CANHOTO conforme o caso e use o perfil correto nas etapas seguintes.
Após corrigir, confirme com o cliente: "Anotado! Vou considerar que você é [Destro/Canhoto] daqui em diante." e só então avance para a Etapa 2.
IMPORTANTE: Qualquer mensagem do cliente que indique correção — mesmo que indireta como "na verdade sou canhoto" ou "errei, sou destro" — deve ser tratada como correção. Nunca ignore.
IMPORTANTE: Se o cliente fizer qualquer pergunta junto com a confirmação, responda a pergunta primeiro e só então avance para a Etapa 2.

=== ETAPA 2 — Data de nascimento ===
Se o cliente fizer alguma pergunta antes de informar a data, responda à dúvida e em seguida solicite a data.
Se a pergunta for sobre a consulta premium, use exatamente este texto:

A consulta é realizada via chat em nossa própria plataforma. São 30 minutos de conversa exclusiva onde você pode tirar dúvidas específicas e aprofundar a análise (o valor é de ${VALOR_CONSULTA_FORMATADO}). Respondido? Agora, para prosseguirmos: Poderia nos informar sua data de nascimento? Ela é um dado fundamental para que a especialista cruze as informações e entregue o melhor resultado.

Se o cliente não tiver dúvidas, vá direto com este texto:

Para prosseguirmos: Poderia nos informar sua data de nascimento? Ela é um dado fundamental para que a especialista cruze as informações e entregue o melhor resultado.

Se o formato estiver errado: "Esse formato não consegui compreender, vamos por partes:" — peça dia, mês e ano separadamente.
Sempre confirme: "Então sua data de nascimento é [DD/MM/AAAA], certo?" — só avance com a confirmação do cliente.

=== ETAPA 3 — Solicitação de materiais ===

SE O CLIENTE FOR DESTRO:
Inclua o token ETAPA_FOTOS_DESTRO na sua resposta e envie exatamente este texto:

Muito bem. Agora chegamos à parte mais importante: os materiais para análise. Para que a especialista chegue preparada à sua sessão, preciso de dois arquivos:

Arquivo principal: imagem nítida, com boa iluminação e enquadramento adequado.
Arquivo complementar: imagem da perspectiva lateral, capturando os detalhes necessários.

Capriche na iluminação para que ela consiga ver cada detalhe!

SE O CLIENTE FOR CANHOTO:
Inclua o token ETAPA_FOTOS_CANHOTO na sua resposta e envie exatamente este texto:

Muito bem. Agora chegamos à parte mais importante: os materiais para análise.

Para uma análise mais completa e detalhada, a especialista precisará de quatro arquivos para garantir a precisão da sessão — comparando os dois conjuntos, ela consegue cruzar informações com a profundidade que 38 anos de experiência exigem.

Conjunto principal:
Arquivo 1: imagem nítida, com boa iluminação e enquadramento adequado
Arquivo 2: imagem da perspectiva lateral, capturando os detalhes necessários

Conjunto complementar:
Arquivo 3: imagem nítida, com boa iluminação e enquadramento adequado
Arquivo 4: imagem da perspectiva lateral, capturando os detalhes necessários

Procure um ambiente bem iluminado!

IMPORTANTE: Nunca solicite materiais sem incluir o token correspondente na resposta.
REGRA: Não avance enquanto todos os arquivos não forem enviados.

=== ETAPA 4 — Encerramento ===
Informe que os materiais foram recebidos e que agora é só finalizar pelo dashboard:
- Adicionar créditos via PIX (${VALOR_CONSULTA_FORMATADO})
- Após o pagamento: agendamento liberado, o cliente escolhe o melhor horário
- A consulta ao vivo acontece aqui na plataforma, por chat, com 30 minutos com a especialista
Encerre com entusiasmo e energia positiva.

Escreva exatamente o token TRIAGEM_CONCLUIDA em algum lugar da sua resposta.`
}

export async function POST(request: NextRequest) {
  try {
    // Identifica o usuário pela sessão autenticada — nunca pelo body da requisição,
    // que pode ser manipulado por qualquer chamador.
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const parsed = aiTriagemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }
    const { photosConfirmed, consultationId, photos, isPromocao, isRetornante, handDominance } = parsed.data
    const messages = parsed.data.messages as TriagemMessage[]
    const userId = user.id

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {

      return NextResponse.json({ error: 'Gemini API key não configurada.' }, { status: 500 })
    }

    if (!consultationId) {
      console.warn("Aviso: consultationId não fornecido. O histórico não será salvo no banco.")
    } else {
      // Garante que a consulta pertence ao usuário autenticado antes de escrever nela.
      const { data: consultation } = await supabase
        .from('consultations')
        .select('id')
        .eq('id', consultationId)
        .eq('user_id', userId)
        .single()

      if (!consultation) {
        return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
      }
    }

    const history: TriagemMessage[] = messages.length === 0
      ? []
      : messages.slice(0, -1)

    const lastUserMessage = messages.length > 0 ? messages[messages.length - 1] : null

    const userText = photosConfirmed
      ? (lastUserMessage?.parts[0].text ?? '') + '\n[Sistema: O cliente confirmou o upload das fotos solicitadas.]'
      : lastUserMessage?.parts[0].text ?? ''

    // ── 1. SALVA A MENSAGEM DO USUÁRIO NO BANCO ──
    if (consultationId && userId && userText) {
      const { error: insertUserError } = await supabase.from('messages').insert({
        consultation_id: consultationId,
        sender_id: userId,
        content: userText,
        is_ai: false,
        message_type: 'text'
      })
      if (insertUserError) console.error("Erro ao salvar msg do usuário:", insertUserError)
    }

    // ── 1b. FAZ UPLOAD DAS FOTOS VIA SERVICE ROLE ──
if (photosConfirmed && photos && photos.length > 0 && consultationId && userId) {
  const photoLabels: Record<number, string[]> = {
    2: ['direita', 'direita'],
    4: ['esquerda', 'esquerda', 'direita', 'direita'],
  }
  const labels = photoLabels[photos.length] ?? photos.map(() => 'direita')

  for (let i = 0; i < photos.length; i++) {
    const base64 = photos[i]
    // Remove o prefixo "data:image/jpeg;base64," etc.
    const matches = base64.match(/^data:(.+);base64,(.+)$/)
    if (!matches) continue

    const mimeType = matches[1]
    const ext = mimeType.split('/')[1] ?? 'jpg'
    const buffer = Buffer.from(matches[2], 'base64')
    const path = `${userId}/${consultationId}/${Date.now()}-${labels[i]}.${ext}`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('consultation-photos')
      .upload(path, buffer, { contentType: mimeType, upsert: false })

    if (storageError) {
      console.error(`Erro upload foto ${i + 1}:`, storageError)
      continue
    }

    const { data: publicUrlData } = supabase.storage
      .from('consultation-photos')
      .getPublicUrl(storageData.path)

    await supabase.from('photos').insert({
      consultation_id: consultationId,
      storage_url: publicUrlData.publicUrl,
      hand_type: labels[i].replace(/_/g, ' '),
      status: 'pending',
    })

  }
}

      const systemPrompt = isPromocao
        ? buildSystemPromptGratuito(handDominance ?? '')
        : buildSystemPromptPremium(handDominance ?? '')

      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...history,
            ...(userText ? [{ role: 'user', parts: [{ text: userText }] }] : []),
          ],
      generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 400,
      thinkingConfig: { thinkingBudget: 0 },  // ← desativa thinking
},
  }

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

      let res: Response | null = null
      let data: any = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (res.status === 503 && attempt < 3) {
          console.warn(`Gemini 503 — tentativa ${attempt}/3. Aguardando ${attempt * 1500}ms...`)
          await new Promise(r => setTimeout(r, attempt * 1500))
          continue
        }

        if (!res.ok) {
          const err = await res.text()
          console.error('Gemini error:', err)
          return NextResponse.json({ error: 'Erro ao chamar Gemini.' }, { status: 500 })
        }

        data = await res.json()
        break
      }

      if (!data) {
        return NextResponse.json({ error: 'Gemini indisponível. Tente novamente em instantes.' }, { status: 503 })
      }
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // ── Detecta tokens especiais ──
    const showDominance  = text.includes('MOSTRAR_DOMINANCIA')
    const showUploaderDestro  = text.includes('ETAPA_FOTOS_DESTRO')
    const atualizarDestro  = text.includes('ATUALIZAR_DESTRO')
    const atualizarCanhoto = text.includes('ATUALIZAR_CANHOTO')
    const showUploaderCanhoto = text.includes('ETAPA_FOTOS_CANHOTO')
    const showUploader   = showUploaderDestro || showUploaderCanhoto
    const isComplete     = text.includes('TRIAGEM_CONCLUIDA')
    const photoCount     = showUploaderDestro ? 2 : showUploaderCanhoto ? 4 : null

    if ((atualizarDestro || atualizarCanhoto) && userId) {
    const novaDominancia = atualizarDestro ? 'destro' : 'canhoto'
    await supabase
      .from('profiles')
      .update({ hand_dominance: novaDominancia })
      .eq('id', userId)
  }

    // ── Limpa tokens do texto exibido ──
    const cleanText = text
    .replace('MOSTRAR_DOMINANCIA', '')
    .replace('ETAPA_FOTOS_DESTRO', '')
    .replace('ETAPA_FOTOS_CANHOTO', '')
    .replace('TRIAGEM_CONCLUIDA', '')
    .replace('ATUALIZAR_DESTRO', '')
    .replace('ATUALIZAR_CANHOTO', '')
    .trim()

    // ── 2. SALVA A RESPOSTA DA IA NO BANCO ──
    if (consultationId && cleanText) {
      const { error: insertAiError } = await supabase.from('messages').insert({
        consultation_id: consultationId,
        content: cleanText,
        is_ai: true,
        message_type: 'text'
      })
      if (insertAiError) console.error("Erro ao salvar msg da IA:", insertAiError)
    }
  
    if (isComplete && consultationId && userId) {
        const { error: updateError } = await supabase
          .from('consultations')
          .update({ status: 'aguardando_analise' })
          .eq('id', consultationId)

        if (updateError) console.error('Erro ao atualizar status:', updateError)

        // Disparar e-mail de triagem recebida
        const { data: perfil } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', userId)
          .single()

        if (perfil) {
          const firstName = perfil.full_name?.split(' ')[0] ?? 'cliente'
          await sendEmail({
            to: perfil.email,
            subject: 'Recebemos sua triagem! ✨',
            template: <EmailTriagemRecebida nome={firstName} />,
          })
        }
      }


    return NextResponse.json({
      text: cleanText,
        showUploader,
        showDominance,
        isComplete,
        photoCount,
    })

  } catch (err) {
    console.error('Triagem route error:', err)
    
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}