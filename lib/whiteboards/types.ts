export type BoardStatus = 'active' | 'archived'
export type BoardTemplateCategory =
  | 'brainstorm'
  | 'gameplay'
  | 'scope'
  | 'level'
  | 'ui'
  | 'custom'

export interface BoardRecord {
  id: string
  project_id: string
  title: string
  status: BoardStatus
  is_locked: boolean
  thumbnail_key: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  creator?: {
    id: string
    name: string | null
    avatar_url: string | null
  } | null
}

export interface BoardAssetRecord {
  id: string
  board_id: string
  file_id: string
  storage_key: string
  mime_type: string
  size_bytes: number
  status: 'pending' | 'ready'
  uploaded_by: string | null
  created_at: string
}

export interface BoardTaskLinkRecord {
  id: string
  board_id: string
  task_id: string
  element_id: string | null
  created_by: string | null
  created_at: string
}

export interface TaskLinkedBoardItem {
  link_id: string
  board_id: string
  board_title: string
  board_status: BoardStatus
  project_slug: string
  element_id: string | null
}

export interface BoardTemplateRecord {
  id: string
  organization_id: string | null
  slug: string | null
  title: string
  category: BoardTemplateCategory
  description: string | null
  content: {
    elements: Record<string, unknown>[]
    appState?: Record<string, unknown>
  }
  is_system: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BoardFileRef {
  fileId: string
  mimeType: string
  status: 'uploading' | 'ready' | 'error'
  width?: number
  height?: number
}

export interface BoardCollaboratorPresence {
  user: {
    id: string
    name: string
    avatarUrl: string | null
    color: string
  }
  pointer?: {
    x: number
    y: number
    tool: 'pointer' | 'laser'
  }
  button?: 'up' | 'down'
  selectedElementIds?: Record<string, true>
}

