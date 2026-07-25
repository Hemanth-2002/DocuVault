import { supabase } from './supabaseClient'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function summarizeDocument(documentId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ summary: string }>('summarize-document', {
    body: { documentId },
  })
  if (error || !data) throw error ?? new Error('Failed to generate summary')
  return data.summary
}

export async function askDocumentStream(
  documentId: string,
  question: string,
  history: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ documentId, question, history }),
  })

  if (!response.ok || !response.body) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error ?? 'Failed to get an answer')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}
