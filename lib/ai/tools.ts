import { z } from 'zod'

export const ListTasksSchema = z.object({
  projectId: z.string().uuid(),
})

export const ListMilestonesSchema = z.object({
  projectId: z.string().uuid(),
})

export const CreateTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional().default('todo'),
  milestone_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  subtasks: z.array(z.string().min(1)).optional(),
})

export const UpdateTaskSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(150).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  milestone_id: z.string().nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
})

export const UpdateTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  newStatus: z.enum(['todo', 'in_progress', 'review', 'done']),
})

export const CreateSubtaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(1).max(200),
})

export const CreateMilestoneSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(100),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'done']).optional().default('not_started'),
})

export const ListProjectsSchema = z.object({}).strict()

export const GetProjectSchema = z.object({
  projectId: z.string().uuid(),
})

export const ListProfilesSchema = z.object({}).strict()

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100)
    .optional(),
  type: z.enum(['jam', 'competition', 'internal']),
  start_date: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export const UpdateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100)
    .optional(),
  type: z.enum(['jam', 'competition', 'internal']).optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  start_date: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

export const ArchiveProjectSchema = z.object({
  projectId: z.string().uuid(),
})

export const UpdateSubtaskStatusSchema = z.object({
  subtaskId: z.string().uuid(),
  status: z.enum(['todo', 'done']),
})

export const UpdateSubtaskTitleSchema = z.object({
  subtaskId: z.string().uuid(),
  title: z.string().min(1).max(200),
})

export const DeleteTaskSchema = z.object({
  taskId: z.string().uuid(),
})

export const DeleteSubtaskSchema = z.object({
  subtaskId: z.string().uuid(),
})

export const UpdateMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(100).optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(['not_started', 'in_progress', 'done']).optional(),
})

export const DeleteMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
})

export const CreateAssetSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['sprite', 'audio', '3d_model', 'font', 'vfx', 'other']),
  task_id: z.string().uuid().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done', 'implemented']).optional().default('todo'),
  needs_credit: z.boolean().optional().default(false),
  notes: z.string().max(500).optional().nullable(),
})

export const UpdateAssetStatusSchema = z.object({
  assetId: z.string().uuid(),
  status: z.enum(['todo', 'in_progress', 'done', 'implemented']),
})

export const DeleteAssetSchema = z.object({
  assetId: z.string().uuid(),
})

export const CreateCreditSchema = z
  .object({
    project_id: z.string().uuid(),
    source_name: z.string().min(1).max(150),
    author: z.string().max(100).optional().nullable(),
    license: z.enum(['cc0', 'cc_by', 'royalty_free', 'proprietary', 'other']),
    source_url: z.string().url().or(z.literal('')).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    asset_id: z.string().uuid().or(z.literal('')).optional().nullable(),
  })
  .refine((data) => (data.license !== 'cc0' ? !!data.source_url : true), {
    message: 'Source URL is required for non-CC0 licenses',
    path: ['source_url'],
  })

export const DeleteCreditSchema = z.object({
  creditId: z.string().uuid(),
})

export const ExportCreditsSchema = z.object({
  projectId: z.string().uuid(),
})

export const CreateArtifactSchema = z.object({
  project_id: z.string().uuid(),
  label: z.string().min(1).max(100),
  type: z.enum(['figma', 'figjam', 'gdd', 'build', 'other']),
  url: z.string().url(),
  notes: z.string().max(500).optional().nullable(),
})

export const DeleteArtifactSchema = z.object({
  artifactId: z.string().uuid(),
})

export const UploadAssetFileSchema = z.object({
  assetId: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(150),
  contentBase64: z.string().min(1).max(28_000_000),
})

export const UploadBundleSchema = z.object({
  project_id: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(150).optional().default('application/zip'),
  contentBase64: z.string().min(1).max(28_000_000),
})

export const UploadArtifactFileSchema = z.object({
  project_id: z.string().uuid(),
  label: z.string().min(1).max(100),
  type: z.enum(['build', 'gdd']),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(150).optional(),
  contentBase64: z.string().min(1).max(28_000_000),
  notes: z.string().max(500).optional().nullable(),
})

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT'
    properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>
    required?: string[]
  }
}

export const GEMINI_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: 'list_projects',
    description: 'List all projects for grounding before other calls.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_profiles',
    description: 'List team members to resolve a name to assignee ID.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_project',
    description: 'Get a single project by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks in a project for grounding titles to IDs.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task in a project. Optionally include subtask titles.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project_id: { type: 'STRING', description: 'Project UUID' },
        title: { type: 'STRING', description: 'Task title' },
        description: { type: 'STRING', description: 'Task description' },
        status: { type: 'STRING', enum: ['todo', 'in_progress', 'review', 'done'] },
        milestone_id: { type: 'STRING', description: 'Milestone UUID' },
        assignee_id: { type: 'STRING', description: 'Assignee user UUID' },
        due_date: { type: 'STRING', description: 'Due date YYYY-MM-DD' },
        subtasks: { type: 'ARRAY', description: 'Subtask titles', items: { type: 'STRING' } },
      },
      required: ['project_id', 'title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update task fields by ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'Task UUID' },
        projectId: { type: 'STRING', description: 'Project UUID' },
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        status: { type: 'STRING', enum: ['todo', 'in_progress', 'review', 'done'] },
        milestone_id: { type: 'STRING' },
        assignee_id: { type: 'STRING' },
        due_date: { type: 'STRING' },
      },
      required: ['taskId', 'projectId'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Move a task to a new status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'Task UUID' },
        projectId: { type: 'STRING', description: 'Project UUID' },
        newStatus: { type: 'STRING', enum: ['todo', 'in_progress', 'review', 'done'] },
      },
      required: ['taskId', 'projectId', 'newStatus'],
    },
  },
  {
    name: 'create_subtask',
    description: 'Add a subtask to a task.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'Parent task UUID' },
        title: { type: 'STRING', description: 'Subtask title' },
      },
      required: ['taskId', 'title'],
    },
  },
  {
    name: 'list_milestones',
    description: 'List milestones in a project.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'create_milestone',
    description: 'Create a milestone in a project.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project_id: { type: 'STRING', description: 'Project UUID' },
        title: { type: 'STRING', description: 'Milestone title' },
        start_date: { type: 'STRING', description: 'Start date YYYY-MM-DD' },
        due_date: { type: 'STRING', description: 'Due date YYYY-MM-DD' },
        status: { type: 'STRING', enum: ['not_started', 'in_progress', 'done'] },
      },
      required: ['project_id', 'title'],
    },
  },
  {
    name: 'update_milestone',
    description: 'Update milestone fields by ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        milestoneId: { type: 'STRING', description: 'Milestone UUID' },
        title: { type: 'STRING' },
        start_date: { type: 'STRING' },
        due_date: { type: 'STRING' },
        status: { type: 'STRING', enum: ['not_started', 'in_progress', 'done'] },
      },
      required: ['milestoneId'],
    },
  },
  {
    name: 'delete_milestone',
    description: 'Delete a milestone by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { milestoneId: { type: 'STRING', description: 'Milestone UUID' } },
      required: ['milestoneId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { taskId: { type: 'STRING', description: 'Task UUID' } },
      required: ['taskId'],
    },
  },
  {
    name: 'update_subtask_status',
    description: 'Set subtask status to todo or done.',
    parameters: {
      type: 'OBJECT',
      properties: {
        subtaskId: { type: 'STRING', description: 'Subtask UUID' },
        status: { type: 'STRING', enum: ['todo', 'done'] },
      },
      required: ['subtaskId', 'status'],
    },
  },
  {
    name: 'update_subtask_title',
    description: 'Rename a subtask.',
    parameters: {
      type: 'OBJECT',
      properties: {
        subtaskId: { type: 'STRING', description: 'Subtask UUID' },
        title: { type: 'STRING' },
      },
      required: ['subtaskId', 'title'],
    },
  },
  {
    name: 'delete_subtask',
    description: 'Delete a subtask by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { subtaskId: { type: 'STRING', description: 'Subtask UUID' } },
      required: ['subtaskId'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a project. Drive folder is not provisioned via MCP.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Project name' },
        slug: { type: 'STRING', description: 'URL slug lowercase hyphen' },
        type: { type: 'STRING', enum: ['jam', 'competition', 'internal'] },
        start_date: { type: 'STRING' },
        deadline: { type: 'STRING' },
        description: { type: 'STRING' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'update_project',
    description: 'Update project fields by ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        projectId: { type: 'STRING', description: 'Project UUID' },
        name: { type: 'STRING' },
        slug: { type: 'STRING' },
        type: { type: 'STRING', enum: ['jam', 'competition', 'internal'] },
        status: { type: 'STRING', enum: ['active', 'completed', 'archived'] },
        start_date: { type: 'STRING' },
        deadline: { type: 'STRING' },
        description: { type: 'STRING' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'archive_project',
    description: 'Archive a project by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'list_assets',
    description: 'List assets in a project.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'create_asset',
    description: 'Create an asset entry, metadata only without file upload.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project_id: { type: 'STRING', description: 'Project UUID' },
        name: { type: 'STRING' },
        type: { type: 'STRING', enum: ['sprite', 'audio', '3d_model', 'font', 'vfx', 'other'] },
        task_id: { type: 'STRING', description: 'Task UUID' },
        status: { type: 'STRING', enum: ['todo', 'in_progress', 'done', 'implemented'] },
        needs_credit: { type: 'BOOLEAN' },
        notes: { type: 'STRING' },
      },
      required: ['project_id', 'name', 'type'],
    },
  },
  {
    name: 'update_asset_status',
    description: 'Set asset status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        assetId: { type: 'STRING', description: 'Asset UUID' },
        status: { type: 'STRING', enum: ['todo', 'in_progress', 'done', 'implemented'] },
      },
      required: ['assetId', 'status'],
    },
  },
  {
    name: 'delete_asset',
    description: 'Delete an asset by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { assetId: { type: 'STRING', description: 'Asset UUID' } },
      required: ['assetId'],
    },
  },
  {
    name: 'list_bundles',
    description: 'List asset bundles in a project.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'list_credits',
    description: 'List credits in a project.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'create_credit',
    description: 'Create a credit entry.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project_id: { type: 'STRING', description: 'Project UUID' },
        source_name: { type: 'STRING' },
        author: { type: 'STRING' },
        license: { type: 'STRING', enum: ['cc0', 'cc_by', 'royalty_free', 'proprietary', 'other'] },
        source_url: { type: 'STRING' },
        notes: { type: 'STRING' },
        asset_id: { type: 'STRING', description: 'Asset UUID' },
      },
      required: ['project_id', 'source_name', 'license'],
    },
  },
  {
    name: 'delete_credit',
    description: 'Delete a credit by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { creditId: { type: 'STRING', description: 'Credit UUID' } },
      required: ['creditId'],
    },
  },
  {
    name: 'export_credits',
    description: 'Export project credits as markdown text.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'list_artifacts',
    description: 'List artifact links in a project.',
    parameters: {
      type: 'OBJECT',
      properties: { projectId: { type: 'STRING', description: 'Project UUID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'create_artifact',
    description: 'Create an artifact link.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project_id: { type: 'STRING', description: 'Project UUID' },
        label: { type: 'STRING' },
        type: { type: 'STRING', enum: ['figma', 'figjam', 'gdd', 'build', 'other'] },
        url: { type: 'STRING' },
        notes: { type: 'STRING' },
      },
      required: ['project_id', 'label', 'type', 'url'],
    },
  },
  {
    name: 'delete_artifact',
    description: 'Delete an artifact link by ID.',
    parameters: {
      type: 'OBJECT',
      properties: { artifactId: { type: 'STRING', description: 'Artifact UUID' } },
      required: ['artifactId'],
    },
  },
  {
    name: 'upload_asset_file',
    description: 'Upload a file for an asset. Base64 content, 15MB raw max. Needs linked Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        assetId: { type: 'STRING', description: 'Asset UUID' },
        fileName: { type: 'STRING' },
        mimeType: { type: 'STRING' },
        contentBase64: { type: 'STRING', description: 'Base64 file content' },
      },
      required: ['assetId', 'fileName', 'mimeType', 'contentBase64'],
    },
  },
  {
    name: 'upload_bundle',
    description: 'Upload a bundle archive to Builds. Base64 content, 15MB raw max. Needs linked Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project_id: { type: 'STRING', description: 'Project UUID' },
        fileName: { type: 'STRING' },
        mimeType: { type: 'STRING' },
        contentBase64: { type: 'STRING', description: 'Base64 file content' },
      },
      required: ['project_id', 'fileName', 'contentBase64'],
    },
  },
  {
    name: 'upload_artifact_file',
    description: 'Upload a build or GDD file and link it. Base64 content, 15MB raw max. Needs linked Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project_id: { type: 'STRING', description: 'Project UUID' },
        label: { type: 'STRING' },
        type: { type: 'STRING', enum: ['build', 'gdd'] },
        fileName: { type: 'STRING' },
        mimeType: { type: 'STRING' },
        contentBase64: { type: 'STRING', description: 'Base64 file content' },
        notes: { type: 'STRING' },
      },
      required: ['project_id', 'label', 'type', 'fileName', 'contentBase64'],
    },
  },
]
