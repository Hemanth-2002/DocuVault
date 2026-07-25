import { useEffect, useState } from 'react'
import { Box, Typography, Stack, Card, CardActionArea, CardContent, Avatar, Chip } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import DescriptionIcon from '@mui/icons-material/Description'
import { useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { AppLayout } from '../components/AppLayout'
import { supabase } from '../lib/supabaseClient'
import type { ProfileWithCount } from '../types'

export function AdminUserList() {
  const [users, setUsers] = useState<ProfileWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: profiles, error: profilesError }, { data: docs, error: docsError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'user').order('created_at', { ascending: false }),
        supabase.from('documents').select('user_id'),
      ])

      if (profilesError || docsError) {
        enqueueSnackbar('Failed to load users.', { variant: 'error' })
        setLoading(false)
        return
      }

      const counts = new Map<string, number>()
      for (const d of docs ?? []) {
        counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + 1)
      }

      setUsers((profiles ?? []).map((p) => ({ ...p, document_count: counts.get(p.id) ?? 0 })))
      setLoading(false)
    }
    load()
  }, [enqueueSnackbar])

  return (
    <AppLayout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Users
          </Typography>
          <Typography color="text.secondary">Select a user to view their documents.</Typography>
        </Box>

        {loading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : users.length === 0 ? (
          <Typography color="text.secondary">No users yet.</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 2,
            }}
          >
            {users.map((u) => (
              <Card key={u.id} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardActionArea onClick={() => navigate(`/admin/users/${u.id}`)}>
                  <CardContent>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <PersonIcon />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 600 }}>
                          {u.email}
                        </Typography>
                        <Chip
                          size="small"
                          icon={<DescriptionIcon />}
                          label={`${u.document_count} document${u.document_count === 1 ? '' : 's'}`}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}
      </Stack>
    </AppLayout>
  )
}
