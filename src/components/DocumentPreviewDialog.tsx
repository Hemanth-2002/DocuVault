import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Box,
  CircularProgress,
  Typography,
  Tabs,
  Tab,
  TextField,
  Stack,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import SendIcon from '@mui/icons-material/Send'
import { useQuery } from '@tanstack/react-query'
import mammoth from 'mammoth'
import ReactMarkdown from 'react-markdown'
import { supabase, DOCUMENTS_BUCKET } from '../lib/supabaseClient'
import { summarizeDocument, askDocumentStream, type ChatMessage } from '../lib/ai'
import type { DocumentRow } from '../types'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const markdownSx = {
  typography: 'body2',
  '& p': { m: 0 },
  '& p + p': { mt: 1 },
  '& ul, & ol': { m: 0, mt: 0.5, pl: 2.5 },
  '& li + li': { mt: 0.25 },
} as const

interface DocumentPreviewDialogProps {
  doc: DocumentRow | null
  onClose: () => void
}

export function DocumentPreviewDialog({ doc, onClose }: DocumentPreviewDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  const {
    data: blob,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['document-blob', doc?.id],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(doc!.storage_path)
      if (error || !data) throw error ?? new Error('Download failed')
      return data
    },
    enabled: !!doc,
    staleTime: Infinity,
  })

  const mimeType = doc?.mime_type ?? ''
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const isText = mimeType === 'text/plain'
  const isDocx = mimeType === DOCX_MIME
  const isPreviewable = isImage || isPdf || isText || isDocx
  const supportsAi = isPdf || isDocx || isText

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [docxHtml, setDocxHtml] = useState<string | null>(null)

  const [tab, setTab] = useState<'preview' | 'ask'>('preview')
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [scrollSignal, setScrollSignal] = useState(0)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [scrollSignal])

  useEffect(() => {
    setObjectUrl(null)
    setTextContent(null)
    setDocxHtml(null)
    if (!blob) return

    if (isImage || isPdf) {
      const url = URL.createObjectURL(blob)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    if (isText) {
      blob.text().then(setTextContent)
    }
    if (isDocx) {
      blob.arrayBuffer().then((buffer) =>
        mammoth.convertToHtml({ arrayBuffer: buffer }).then((result) => setDocxHtml(result.value)),
      )
    }
  }, [blob, isImage, isPdf, isText, isDocx])

  useEffect(() => {
    setTab('preview')
    setSummary(doc?.summary ?? null)
    setSummaryLoading(false)
    setSummaryError(null)
    setChatMessages([])
    setChatInput('')
    setChatError(null)
    setChatLoading(false)
  }, [doc?.id])

  useEffect(() => {
    if (tab !== 'ask' || !doc || !supportsAi || summary !== null) return
    let cancelled = false
    setSummaryLoading(true)
    summarizeDocument(doc.id)
      .then((result) => {
        if (!cancelled) setSummary(result)
      })
      .catch((err) => {
        if (!cancelled) setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary.')
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, doc?.id, supportsAi, summary])

  const handleDownload = () => {
    if (!blob || !doc) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!doc || !chatInput.trim() || chatLoading) return
    const question = chatInput.trim()
    const priorMessages = chatMessages
    setChatInput('')
    setChatError(null)
    setChatMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }])
    setScrollSignal((n) => n + 1)
    setChatLoading(true)
    try {
      await askDocumentStream(doc.id, question, priorMessages, (chunk) => {
        setChatMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          next[next.length - 1] = { ...last, content: last.content + chunk }
          return next
        })
      })
    } catch (err) {
      setChatMessages((prev) => prev.slice(0, -1))
      setChatError(err instanceof Error ? err.message : 'Failed to get an answer.')
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <Dialog open={!!doc} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc?.file_name}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {supportsAi && (
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, minHeight: 40 }}>
          <Tab value="preview" label="Preview" sx={{ minHeight: 40 }} />
          <Tab value="ask" label="Ask AI" sx={{ minHeight: 40 }} />
        </Tabs>
      )}

      <DialogContent dividers sx={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
        {tab === 'preview' && (
          <>
            {isLoading && (
              <Box sx={{ m: 'auto' }}>
                <CircularProgress />
              </Box>
            )}

            {isError && (
              <Typography color="error" sx={{ m: 'auto' }}>
                Failed to load document.
              </Typography>
            )}

            {!isLoading && !isError && blob && !isPreviewable && (
              <Typography color="text.secondary" sx={{ m: 'auto' }}>
                Preview not available for this file type — use Download instead.
              </Typography>
            )}

            {!isLoading && !isError && blob && isImage && objectUrl && (
              <Box
                component="img"
                src={objectUrl}
                alt={doc?.file_name}
                sx={{ maxWidth: '100%', maxHeight: '70vh', mx: 'auto', objectFit: 'contain' }}
              />
            )}

            {!isLoading && !isError && blob && isPdf && objectUrl && (
              <Box
                component="embed"
                src={objectUrl}
                type="application/pdf"
                sx={{ width: '100%', height: '70vh', border: 0 }}
              />
            )}

            {!isLoading && !isError && blob && isText && (
              <Box
                component="pre"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: 14, m: 0 }}
              >
                {textContent ?? ''}
              </Box>
            )}

            {!isLoading && !isError && blob && isDocx && (
              docxHtml !== null ? (
                <Box sx={{ '& img': { maxWidth: '100%' } }} dangerouslySetInnerHTML={{ __html: docxHtml }} />
              ) : (
                <Box sx={{ m: 'auto' }}>
                  <CircularProgress size={24} />
                </Box>
              )
            )}
          </>
        )}

        {tab === 'ask' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, gap: 2 }}>
            <Stack ref={chatScrollRef} spacing={1.5} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
              {(summaryLoading || summary || summaryError) && (
                <Box sx={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, ml: 0.5 }}>
                    Summary
                  </Typography>
                  {summaryError ? (
                    <Alert severity="error" sx={{ py: 0.5 }}>
                      {summaryError}
                    </Alert>
                  ) : (
                    <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                      {summaryLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <Box sx={markdownSx}>
                          <ReactMarkdown>{summary}</ReactMarkdown>
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {chatMessages.map((message, index) =>
                message.content === '' ? null : (
                  <Box
                    key={index}
                    sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}
                  >
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        bgcolor: message.role === 'user' ? 'primary.main' : 'action.hover',
                        color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                      }}
                    >
                      {message.role === 'assistant' ? (
                        <Box sx={markdownSx}>
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {message.content}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ),
              )}
              {chatLoading && chatMessages[chatMessages.length - 1]?.content === '' && (
                <Box sx={{ alignSelf: 'flex-start' }}>
                  <CircularProgress size={16} />
                </Box>
              )}
            </Stack>

            {chatError && <Alert severity="error">{chatError}</Alert>}

            <Box component="form" onSubmit={handleAsk} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Ask a question about this document…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <IconButton type="submit" color="primary" disabled={chatLoading || !chatInput.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        )}
      </DialogContent>

      {tab === 'preview' && (
        <DialogActions>
          <Button startIcon={<DownloadIcon />} onClick={handleDownload} disabled={!blob}>
            Download
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
