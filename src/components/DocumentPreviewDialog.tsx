import { useEffect, useState } from 'react'
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
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import { useQuery } from '@tanstack/react-query'
import mammoth from 'mammoth'
import { supabase, DOCUMENTS_BUCKET } from '../lib/supabaseClient'
import type { DocumentRow } from '../types'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

interface DocumentPreviewDialogProps {
  doc: DocumentRow | null
  onClose: () => void
}

export function DocumentPreviewDialog({ doc, onClose }: DocumentPreviewDialogProps) {
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

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [docxHtml, setDocxHtml] = useState<string | null>(null)

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

  const handleDownload = () => {
    if (!blob || !doc) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={!!doc} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc?.file_name}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
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
      </DialogContent>

      <DialogActions>
        <Button startIcon={<DownloadIcon />} onClick={handleDownload} disabled={!blob}>
          Download
        </Button>
      </DialogActions>
    </Dialog>
  )
}
