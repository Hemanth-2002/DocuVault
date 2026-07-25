import { useState, type FormEvent, type SyntheticEvent } from 'react'
import { Box, Paper, TextField, Button, Typography, Tabs, Tab, Alert, Stack } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'signup'

export function Login() {
  const { session, profile, loading, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/'} replace />
  }

  const handleModeChange = (_event: SyntheticEvent, value: Mode) => {
    setMode(value)
    setError(null)
    setInfo(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    if (mode === 'signin') {
      const { error: signInError } = await signIn(email, password)
      if (signInError) setError(signInError)
    } else {
      const { error: signUpError, needsEmailConfirmation } = await signUp(email, password)
      if (signUpError) {
        setError(signUpError)
      } else if (needsEmailConfirmation) {
        setInfo('Account created. Check your email to confirm it, then sign in.')
        setMode('signin')
      }
    }
    setSubmitting(false)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper elevation={0} variant="outlined" sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 3 }}>
        <Stack spacing={1} sx={{ mb: 3, alignItems: 'center' }}>
          <DescriptionIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            DocuVault
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Upload, store and manage your documents
          </Typography>
        </Stack>

        <Tabs value={mode} onChange={handleModeChange} variant="fullWidth" sx={{ mb: 3 }}>
          <Tab label="Sign in" value="signin" />
          <Tab label="Sign up" value="signup" />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {info && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {info}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              slotProps={{ htmlInput: { minLength: 6 } }}
            />
            <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}
