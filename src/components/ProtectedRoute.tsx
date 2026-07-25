import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

export function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode
  requireRole?: Role
}) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />
  }

  if (requireRole && profile.role !== requireRole) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/'} replace />
  }

  return <>{children}</>
}
