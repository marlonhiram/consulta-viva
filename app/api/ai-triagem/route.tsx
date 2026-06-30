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

function buildSystemPrompt() {
  return `Você é o assistente da plataforma ConsultaViva.
Seu papel é conduzir a triagem inicial antes do cliente ser atendido pela especialista.

=== REGRAS DE OURO ===
1. Avance apen as UMA etapa por vez.
2. Siga o texto de cada etapa de forma fiel — não reescreva nem resuma com outras palavras.
3. NÃO peça o nome — o cliente já foi identificado.
4. A avaliação é feita pela especialista humana com 38 anos de experiência — NUNCA pela IA.
5. NUNCA use markdown como **negrito** ou *itálico* — escreva em texto simples.
6. Só mencione a consulta ao vivo se o cliente perguntar — nunca proativamente.

=== ETAPA 1 — Boas-vindas e identificação do contexto ===
Envie exatamente este texto:

Olá! Eu sou o assistente da ConsultaViva. Antes de você falar com a nossa especialista, que tem 38 anos de experiência, eu vou te ajudar com uma triagem inicial.

A consultoria que oferecemos é focada em análise comportamental e autoconhecimento. Para que a especialista possa preparar uma avaliação realmente personalizada para você, preciso entender um pouco mais sobre o seu momento atual.

Por onde você prefere começar? Pode me contar o que está passando ou o que te trouxe até aqui.

Após o cliente compartilhar, acolha com empatia, demonstre que compreendeu, e avance para a Etapa 2.
IMPORTANTE: Se o cliente fizer alguma pergunta antes de compartilhar seu contexto, responda e em seguida repita o convite para ele contar o que está passando.

=== ETAPA 2 — Data de nascimento ===
Se o cliente fizer alguma pergunta antes de informar a data, responda à dúvida e em seguida solicite a data.

Se a pergunta for sobre a consulta ao vivo, use exatamente este texto:

A consulta ao vivo é realizada via chat em nossa própria plataforma. São 30 minutos de conversa exclusiva onde você pode tirar dúvidas específicas e aprofundar a avaliação (o valor é de ${VALOR_CONSULTA_FORMATADO}). Respondido? Agora, para prosseguirmos: Poderia nos informar sua data de nascimento? Ela é um dado fundamental para que a especialista cruze as informações e entregue o melhor resultado.

Se o cliente não tiver dúvidas, vá direto com este texto:

Para prosseguirmos: Poderia nos informar sua data de nascimento? Ela é um dado fundamental para que a especialista cruze as informações e entregue o melhor resultado.

Se o formato estiver errado: "Esse formato não consegui compreender, vamos por partes:" — peça dia, mês e ano separadamente.
Sempre confirme: "Então sua data de nascimento é [DD/MM/AAAA], certo?" — só avance com a confirmação do cliente.

=== ETAPA 3 — Solicitação de foto ===
Inclua o token ETAPA_FOTOS_ROSTO na sua resposta e envie exatamente este texto:

Muito bem. Agora chegamos à última etapa da triagem: precisamos de uma foto sua para que a especialista possa iniciar sua avaliação personalizada.

Por favor, envie uma foto frontal do seu rosto. Procure um ambiente bem iluminado, fundo neutro e certifique-se de que seu rosto esteja centralizado e completamente visível.

IMPORTANTE: Nunca solicite a foto sem incluir o token ETAPA_FOTOS_ROSTO na resposta.
REGRA: Não avance enquanto a foto não for enviada.

=== ETAPA 4 — Conclusão ===
Informe que:
- A solicitação foi recebida com sucesso e está na fila da especialista
- O prazo de resposta é de até 48 horas
- A avaliação ficará disponível no dashboard e será enviada por e-mail
- Caso a foto esteja ilegível, a especialista poderá recusá-la — o cliente receberá uma notificação para reenviar
Encerre com entusiasmo e energia positiva.

Escreva exatamente o token TRIAGEM_CONCLUIDA em algum lugar da sua resposta.`
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const parsed = aiTriagemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }
    const { photosConfirmed, consultationId, photos } = parsed.data
    const messages = parsed.data.messages as TriagemMessage[]
    const userId = user.id

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key não configurada.' }, { status: 500 })
    }

    if (!consultationId) {
      console.warn('Aviso: consultationId não fornecido. O histórico não será salvo no banco.')
    } else {
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

    const history: TriagemMessage[] = messages.length === 0 ? [] : messages.slice(0, -1)
    const lastUserMessage = messages.length > 0 ? messages[messages.length - 1] : null

    const userText = photosConfirmed
      ? (lastUserMessage?.parts[0].text ?? '') + '\n[Sistema: O cliente confirmou o upload da foto solicitada.]'
      : lastUserMessage?.parts[0].text ?? ''

    // ── 1. SALVA A MENSAGEM DO USUÁRIO NO BANCO ──
    if (consultationId && userId && userText) {
      const { error: insertUserError } = await supabase.from('messages').insert({
        consultation_id: consultationId,
        sender_id: userId,
        content: userText,
        is_ai: false,
        message_type: 'text',
      })
      if (insertUserError) console.error('Erro ao salvar msg do usuário:', insertUserError)
    }

    // ── 1b. FAZ UPLOAD DA FOTO VIA SERVICE ROLE ──
    if (photosConfirmed && photos && photos.length > 0 && consultationId && userId) {
      for (let i = 0; i < photos.length; i++) {
        const base64 = photos[i]
        const matches = base64.match(/^data:(.+);base64,(.+)$/)
        if (!matches) continue

        const mimeType = matches[1]
        const ext = mimeType.split('/')[1] ?? 'jpg'
        const buffer = Buffer.from(matches[2], 'base64')
        const path = `${userId}/${consultationId}/${Date.now()}-rosto.${ext}`

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
          hand_type: 'rosto',
          status: 'pending',
        })
      }
    }

    const body = {
      system_instruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: [
        ...history,
        ...(userText ? [{ role: 'user', parts: [{ text: userText }] }] : []),
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
        thinkingConfig: { thinkingBudget: 0 },
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
    const showUploader = text.includes('ETAPA_FOTOS_ROSTO')
    const isComplete   = text.includes('TRIAGEM_CONCLUIDA')

    // ── Limpa tokens do texto exibido ──
    const cleanText = text
      .replace('ETAPA_FOTOS_ROSTO', '')
      .replace('TRIAGEM_CONCLUIDA', '')
      .trim()

    // ── 2. SALVA A RESPOSTA DA IA NO BANCO ──
    if (consultationId && cleanText) {
      const { error: insertAiError } = await supabase.from('messages').insert({
        consultation_id: consultationId,
        content: cleanText,
        is_ai: true,
        message_type: 'text',
      })
      if (insertAiError) console.error('Erro ao salvar msg da IA:', insertAiError)
    }

    if (isComplete && consultationId && userId) {
      const { error: updateError } = await supabase
        .from('consultations')
        .update({ status: 'aguardando_analise' })
        .eq('id', consultationId)

      if (updateError) console.error('Erro ao atualizar status:', updateError)

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
      isComplete,
      photoCount: 1,
    })

  } catch (err) {
    console.error('Triagem route error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
