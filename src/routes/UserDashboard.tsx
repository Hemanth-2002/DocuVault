import { useCallback, useEffect, useState } from 'react'
import { Paper, Typography, Box, Stack } from '@mui/material'
import { useSnackbar } from 'notistack'
import { AppLayout } from '../components/AppLayout'
import { UploadDropzone } from '../components/UploadDropzone'
import { DocumentList } from '../components/DocumentList'
import { supabase, DOCUMENTS_BUCKET } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import type { DocumentRow } from '../types'

export function UserDashboard() {
  const { session } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [uploading, setUploading] = useState(false)

  const userId = session!.user.id
  const userEmail = session!.user.email ?? userId

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      enqueueSnackbar('Failed to load documents.', { variant: 'error' })
    } else {
      setDocuments(data as DocumentRow[])
    }
    setLoadingDocs(false)
  }, [userId, enqueueSnackbar])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleFiles = async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      const path = `${userEmail}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type || undefined })

      if (uploadError) {
        enqueueSnackbar(`Failed to upload "${file.name}": ${uploadError.message}`, { variant: 'error' })
        continue
      }

      const { error: insertError } = await supabase.from('documents').insert({
        user_id: userId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      })

      if (insertError) {
        enqueueSnackbar(`Failed to save "${file.name}" metadata: ${insertError.message}`, { variant: 'error' })
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
        continue
      }

      enqueueSnackbar(`Uploaded "${file.name}".`, { variant: 'success' })
    }
    setUploading(false)
    loadDocuments()
  }

  const handleDownload = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path)
    if (error || !data) {
      enqueueSnackbar('Failed to download file.', { variant: 'error' })
      return
    }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (doc: DocumentRow) => {
    const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path])
    if (storageError) {
      enqueueSnackbar('Failed to delete file.', { variant: 'error' })
      return
    }
    const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id)
    if (dbError) {
      enqueueSnackbar('Failed to delete document record.', { variant: 'error' })
      return
    }
    enqueueSnackbar(`Deleted "${doc.file_name}".`, { variant: 'success' })
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
  }

  return (
    <AppLayout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            My Documents
          </Typography>
          <Typography color="text.secondary">Upload and manage your files.</Typography>
        </Box>

        <UploadDropzone
          uploading={uploading}
          onFiles={handleFiles}
          onRejected={(msg) => enqueueSnackbar(msg, { variant: 'warning' })}
        />

        <Paper variant="outlined" sx={{ borderRadius: 3 }}>
          {loadingDocs ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">Loading…</Typography>
            </Box>
          ) : (
            <DocumentList documents={documents} onDownload={handleDownload} onDelete={handleDelete} />
          )}
        </Paper>
      </Stack>
    </AppLayout>
  )
}
