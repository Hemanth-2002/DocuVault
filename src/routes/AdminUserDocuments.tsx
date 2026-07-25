import { useEffect, useState } from 'react'
import { Box, Typography, Stack, Paper, Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate, useParams } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { AppLayout } from '../components/AppLayout'
import { DocumentList } from '../components/DocumentList'
import { DocumentPreviewDialog } from '../components/DocumentPreviewDialog'
import { supabase, DOCUMENTS_BUCKET } from '../lib/supabaseClient'
import type { DocumentRow, Profile } from '../types'

export function AdminUserDocuments() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null)

  useEffect(() => {
    if (!userId) return
    async function load() {
      setLoading(true)
      const [{ data: profileData, error: profileError }, { data: docsData, error: docsError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('documents').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false }),
      ])

      if (profileError || docsError) {
        enqueueSnackbar('Failed to load user documents.', { variant: 'error' })
      } else {
        setProfile(profileData as Profile)
        setDocuments(docsData as DocumentRow[])
      }
      setLoading(false)
    }
    load()
  }, [userId, enqueueSnackbar])

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

  return (
    <AppLayout>
      <Stack spacing={3}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin')} sx={{ mb: 1 }}>
            Back to users
          </Button>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, wordBreak: 'break-word', fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
          >
            {profile ? profile.email : 'Loading…'}
          </Typography>
          <Typography color="text.secondary">Viewing this user's documents.</Typography>
        </Box>

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">Loading…</Typography>
            </Box>
          ) : (
            <DocumentList
              documents={documents}
              onView={setPreviewDoc}
              onDownload={handleDownload}
              emptyMessage="This user hasn't uploaded any documents yet."
            />
          )}
        </Paper>
      </Stack>

      <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </AppLayout>
  )
}
