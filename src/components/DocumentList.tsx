import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Typography,
  Box,
  Tooltip,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import DescriptionIcon from '@mui/icons-material/Description'
import ImageIcon from '@mui/icons-material/Image'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import type { DocumentRow } from '../types'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconFor(mime: string | null) {
  if (!mime) return <InsertDriveFileIcon color="action" />
  if (mime === 'application/pdf') return <PictureAsPdfIcon color="error" />
  if (mime.startsWith('image/')) return <ImageIcon color="primary" />
  if (mime.includes('word') || mime === 'text/plain') return <DescriptionIcon color="info" />
  return <InsertDriveFileIcon color="action" />
}

interface DocumentListProps {
  documents: DocumentRow[]
  onView: (doc: DocumentRow) => void
  onDownload: (doc: DocumentRow) => void
  onDelete?: (doc: DocumentRow) => void
  emptyMessage?: string
}

export function DocumentList({ documents, onView, onDownload, onDelete, emptyMessage }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography color="text.secondary">{emptyMessage ?? 'No documents yet.'}</Typography>
      </Box>
    )
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Size</TableCell>
          <TableCell>Uploaded</TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id} hover onClick={() => onView(doc)} sx={{ cursor: 'pointer' }}>
            <TableCell>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {iconFor(doc.mime_type)}
                <Typography variant="body2">{doc.file_name}</Typography>
              </Box>
            </TableCell>
            <TableCell>{formatSize(doc.size_bytes)}</TableCell>
            <TableCell>{new Date(doc.uploaded_at).toLocaleString()}</TableCell>
            <TableCell align="right" onClick={(e) => e.stopPropagation()}>
              <Tooltip title="Download">
                <IconButton onClick={() => onDownload(doc)} size="small">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {onDelete && (
                <Tooltip title="Delete">
                  <IconButton onClick={() => onDelete(doc)} size="small" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
