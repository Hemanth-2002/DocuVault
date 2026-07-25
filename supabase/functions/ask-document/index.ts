import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { extractText as extractPdfText, getDocumentProxy } from 'npm:unpdf'
import mammoth from 'npm:mammoth'
import { Buffer } from 'node:buffer'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const SUPPORTED_MIME_TYPES = ['application/pdf', DOCX_MIME, 'text/plain']
const MAX_CHARS = 50_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function createUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing Authorization header')
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
}

async function extractText(bytes: Uint8Array, mimeType: string): Promise<string> {
  let text: string
  if (mimeType === 'text/plain') {
    text = new TextDecoder().decode(bytes)
  } else if (mimeType === 'application/pdf') {
    const pdf = await getDocumentProxy(bytes)
    const result = await extractPdfText(pdf, { mergePages: true })
    text = result.text
  } else if (mimeType === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    text = value
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { documentId, question, history } = await req.json()
    if (!documentId || typeof question !== 'string' || !question.trim()) {
      return json({ error: 'documentId and question are required' }, 400)
    }

    const safeHistory: ChatMessage[] = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({ role: m.role, content: m.content }))
      : []

    const supabase = createUserClient(req)

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !doc) return json({ error: 'Document not found' }, 404)

    if (!doc.mime_type || !SUPPORTED_MIME_TYPES.includes(doc.mime_type)) {
      return json({ error: 'Q&A is not supported for this file type.' }, 400)
    }

    let extractedText = doc.extracted_text as string | null
    if (!extractedText) {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('documents')
        .download(doc.storage_path)
      if (downloadError || !fileBlob) return json({ error: 'Failed to download document.' }, 500)

      const bytes = new Uint8Array(await fileBlob.arrayBuffer())
      extractedText = await extractText(bytes, doc.mime_type)

      const { error: updateError } = await supabase
        .from('documents')
        .update({ extracted_text: extractedText })
        .eq('id', documentId)
      if (updateError) console.error('Failed to cache extracted text', updateError)
    }

    const anthropic = new Anthropic({
      baseURL: Deno.env.get('ANTHROPIC_BASE_URL'),
      authToken: Deno.env.get('ANTHROPIC_AUTH_TOKEN'),
    })

    // system prompt is identical across every question in a chat session, so mark
    // the (large) document text as cacheable to skip reprocessing it on follow-ups
    const rawStream = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      stream: true,
      system: [
        {
          type: 'text',
          text:
            "Answer questions using ONLY the content of the following document. If the answer isn't contained in the document, say you don't know based on the document.\n\nDocument:\n" +
            extractedText,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [...safeHistory, { role: 'user', content: question }],
    })

    const body = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const event of rawStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          console.error('Streaming error', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
