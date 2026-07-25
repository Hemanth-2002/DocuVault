import { useCallback, useRef, useState } from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../lib/supabaseClient'

interface UploadDropzoneProps {
  uploading: boolean
  onFiles: (files: File[]) => void
  onRejected: (message: string) => void
}

const ACCEPT_ATTR = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp'

export function UploadDropzone({ uploading, onFiles, onRejected }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = useCallback(
    (files: FileList | File[]) => {
      const valid: File[] = []
      for (const file of Array.from(files)) {
        if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
          onRejected(`"${file.name}" has an unsupported file type.`)
          continue
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          onRejected(`"${file.name}" exceeds the 20MB limit.`)
          continue
        }
        valid.push(file)
      }
      if (valid.length) onFiles(valid)
    },
    [onFiles, onRejected],
  )

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault()
        if (!uploading) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!uploading) validate(e.dataTransfer.files)
      }}
      onClick={() => !uploading && inputRef.current?.click()}
      sx={{
        border: '2px dashed',
        borderColor: dragging ? 'primary.main' : 'divider',
        borderRadius: 3,
        p: 5,
        textAlign: 'center',
        cursor: uploading ? 'default' : 'pointer',
        bgcolor: dragging ? 'action.hover' : 'background.paper',
        transition: 'all 0.15s ease',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPT_ATTR}
        onChange={(e) => {
          if (e.target.files) validate(e.target.files)
          e.target.value = ''
        }}
      />
      {uploading ? (
        <CircularProgress size={32} />
      ) : (
        <UploadFileIcon sx={{ fontSize: 40 }} color="primary" />
      )}
      <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 600 }}>
        {uploading ? 'Uploading…' : 'Drag & drop files here, or click to browse'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        PDF, Word, TXT, or images — up to 20MB
      </Typography>
    </Box>
  )
}
