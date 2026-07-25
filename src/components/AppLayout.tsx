import type { ReactNode } from 'react'
import { AppBar, Toolbar, Typography, Button, Box, Chip, Container } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import DescriptionIcon from '@mui/icons-material/Description'
import { useAuth } from '../context/AuthContext'

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <DescriptionIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            DocuVault
          </Typography>
          {profile && (
            <>
              <Chip
                label={profile.role === 'admin' ? 'Admin' : 'User'}
                color={profile.role === 'admin' ? 'secondary' : 'primary'}
                size="small"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {profile.email}
              </Typography>
              <Button startIcon={<LogoutIcon />} onClick={() => signOut()} color="inherit">
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Sign out
                </Box>
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        {children}
      </Container>
    </Box>
  )
}
