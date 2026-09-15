import {zod} from '@shopify/cli-kit/node/schema'

// Validate executable children separately: disabled jobs, unused definitions, and
// overridden defaults must not prevent analysis of the configuration we inspect.
export const GitHubWorkflowSchema = zod.object({
  jobs: zod.record(zod.unknown()).optional(),
  defaults: zod.unknown(),
})

export const GitHubReusableDefinitionSchema = zod.object({
  on: zod.union([
    zod.literal('workflow_call'),
    zod.tuple([zod.literal('workflow_call')]),
    zod.record(zod.unknown()).refine((events) => Object.keys(events).length === 1 && 'workflow_call' in events),
  ]),
})

// Headers select which schema to apply without validating disabled execution paths.
export const GitHubJobHeaderSchema = zod.object({if: zod.unknown(), uses: zod.unknown()})
export const GitHubStepsJobSchema = zod.object({steps: zod.array(zod.unknown()), defaults: zod.unknown()})
export const GitHubReusableJobSchema = zod.object({uses: zod.string(), with: zod.unknown()})
export const GitHubStepHeaderSchema = GitHubJobHeaderSchema.extend({run: zod.unknown()})

export const GitHubRunStepSchema = zod.object({
  run: zod.string(),
  // Selection and shell/path validation happen after applying defaults and overrides.
  shell: zod.unknown(),
  'working-directory': zod.unknown(),
})
export const GitHubActionStepSchema = zod.object({
  if: zod.unknown(),
  uses: zod.string(),
  with: zod.record(zod.unknown()).optional(),
})

export const GitHubDefaultsSchema = zod
  .object({
    run: zod.object({shell: zod.unknown(), 'working-directory': zod.unknown()}).optional(),
  })
  .default({})

// OSV inputs can change scan coverage. Do not strip unknown keys before checking them.
export const OsvWorkflowInputsSchema = zod.object({}).strict().optional()

export const DependencyReviewInputsSchema = zod
  .object({
    'config-file': zod.unknown(),
    'vulnerability-check': zod.unknown(),
  })
  .default({})

export const SnykCommandInputsSchema = zod.object({command: zod.string().optional()}).default({})
export const SnykArgsInputsSchema = zod.object({args: zod.string().default('')}).default({})

export type GitHubRunStep = zod.infer<typeof GitHubRunStepSchema>
export type GitHubActionStep = zod.infer<typeof GitHubActionStepSchema>
export type GitHubDefaults = zod.infer<typeof GitHubDefaultsSchema>
