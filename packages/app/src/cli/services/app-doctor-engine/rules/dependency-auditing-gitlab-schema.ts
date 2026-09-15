import {zod} from '@shopify/cli-kit/node/schema'

export const GitLabConfigurationSchema = zod
  .object({
    workflow: zod.object({rules: zod.array(zod.unknown()).optional()}).optional(),
    variables: zod.unknown(),
    include: zod.unknown(),
    default: zod.unknown(),
    before_script: zod.unknown(),
    after_script: zod.unknown(),
  })
  // Non-reserved top-level keys are job definitions, inspected individually.
  .passthrough()

export const GitLabVariablesSchema = zod.object({DS_DISABLED: zod.unknown()}).default({})
export const GitLabDefaultsSchema = zod.object({before_script: zod.unknown(), after_script: zod.unknown()}).default({})

export const GitLabJobSchema = zod.object({
  rules: zod.array(zod.unknown()).optional(),
  when: zod.unknown(),
  extends: zod.unknown(),
  inherit: zod.unknown(),
  // Select inherited scripts only after checking whether the job executes.
  before_script: zod.unknown(),
  script: zod.unknown(),
  after_script: zod.unknown(),
})

const CommandListSchema = zod
  .union([zod.string().transform((command) => [command]), zod.array(zod.string())])
  .default([])

export const GitLabScriptsSchema = zod.object({
  before_script: CommandListSchema,
  script: CommandListSchema,
  after_script: CommandListSchema,
})

export const GitLabNeverRulesSchema = zod.array(zod.object({when: zod.literal('never')})).nonempty()
export const GitLabIncludeHeaderSchema = zod.object({rules: zod.unknown()})
export const GitLabDependencyScanningTemplateSchema = zod.object({
  template: zod.enum(['Security/Dependency-Scanning.gitlab-ci.yml', 'Jobs/Dependency-Scanning.gitlab-ci.yml']),
})
