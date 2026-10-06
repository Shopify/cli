import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {isAbsolutePath, resolvePath} from '@shopify/cli-kit/node/path'

const AIInstructionsSchema = zod.enum(['all', 'github', 'cursor', 'claude']).nullable()
const AbsolutePathSchema = zod.string().refine(isAbsolutePath).describe('An absolute native filesystem path.')

export const themeInitJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeInitResult',
  schema: zod
    .object({
      status: zod.enum(['success', 'partial']),
      changed: zod.literal(true),
      directory: AbsolutePathSchema,
      repoUrl: zod.string().min(1).describe('The source Git remote (including HTTPS, SSH, or SCP-style Git URLs).'),
      latest: zod.boolean(),
      aiInstructions: AIInstructionsSchema,
      instructionFilePaths: zod
        .array(AbsolutePathSchema)
        .nullable()
        .describe('Created instruction files, or null when setup failed before their completion could be established.'),
      reason: zod.string().nullable().describe('The reason for incomplete setup, or null when setup completed.'),
    })
    .strict(),
})

export interface ThemeInitResult {
  path: string
  repoUrl: string
  latest: boolean
  aiInstructions: zod.infer<typeof AIInstructionsSchema>
  instructionFiles: string[]
  status?: 'success' | 'partial'
  reason?: string
}

export function projectThemeInitResult(result: ThemeInitResult) {
  return {
    status: result.status ?? 'success',
    changed: true as const,
    directory: resolvePath(result.path),
    repoUrl: result.repoUrl,
    latest: result.latest,
    aiInstructions: result.aiInstructions,
    instructionFilePaths: result.status === 'partial' ? null : result.instructionFiles.map((path) => resolvePath(path)),
    reason: result.reason ?? null,
  }
}
