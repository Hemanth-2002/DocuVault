import { useState, type FormEvent, type SyntheticEvent } from 'react'
import { Box, Paper, TextField, Button, Typography, Tabs, Tab, Alert, Stack } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'signup'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw: string) => /\d/.test(pw) },
]

export function Login() {
  const { session, profile, loading, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordValid = PASSWORD_RULES.every((rule) => rule.test(password))
  const passwordsMatch = password === confirmPassword
  const canSubmitSignup = passwordValid && passwordsMatch

  if (!loading && session && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/'} replace />
  }

  const handleModeChange = (_event: SyntheticEvent, value: Mode) => {
    setMode(value)
    setError(null)
    setInfo(null)
    setConfirmPassword('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setInfo(null)

    if (mode === 'signup' && !canSubmitSignup) return

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
        setPassword('')
        setConfirmPassword('')
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
      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400, borderRadius: 3 }}>
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

            {mode === 'signup' && (
              <>
                <Stack spacing={0.5} sx={{ mt: -1 }}>
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password)
                    return (
                      <Box key={rule.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {met ? (
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        )}
                        <Typography variant="caption" color={met ? 'success.main' : 'text.secondary'}>
                          {rule.label}
                        </Typography>
                      </Box>
                    )
                  })}
                </Stack>

                <TextField
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  fullWidth
                  autoComplete="new-password"
                  error={confirmPassword.length > 0 && !passwordsMatch}
                  helperText={confirmPassword.length > 0 && !passwordsMatch ? "Passwords don't match" : ' '}
                />
              </>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting || (mode === 'signup' && !canSubmitSignup)}
              fullWidth
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}
