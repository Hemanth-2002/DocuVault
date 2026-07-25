export type Role = 'user' | 'admin'

export interface Profile {
  id: string
  email: string
  role: Role
  created_at: string
}

export interface ProfileWithCount extends Profile {
  document_count: number
}

export interface DocumentRow {
  id: string
  user_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  uploaded_at: string
}
