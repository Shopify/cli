import {zod} from '@shopify/cli-kit/node/schema'

export const CircleConfigurationHeaderSchema = zod.object({workflows: zod.unknown()})
export const CircleConfigurationSchema = zod.object({
  jobs: zod
    .record(zod.unknown())
    .nullish()
    .transform((jobs) => jobs ?? {}),
  workflows: zod.record(zod.unknown()),
  commands: zod.record(zod.unknown()).optional(),
  // Unsupported orb declarations are not evidence; invoked unknown aliases are unresolved.
  orbs: zod.record(zod.unknown()).catch({}),
})

export const CircleWorkflowHeaderSchema = zod.object({when: zod.unknown()})
export const CircleWorkflowSchema = zod.object({jobs: zod.array(zod.unknown())})

const NamedInvocationSchema = zod.record(zod.unknown()).refine((value) => Object.keys(value).length === 1)
export const CircleJobInvocationSchema = zod.union([
  zod.string(),
  NamedInvocationSchema.transform((invocation) => Object.keys(invocation)[0]!),
])
export const CircleStepSchema = NamedInvocationSchema.transform((step) => {
  const [name, settings] = Object.entries(step)[0]!
  return {name, settings}
})

export const CircleJobSchema = zod.object({
  working_directory: zod.unknown(),
  // Only workflow-invoked jobs and their executed steps are inspected.
  steps: zod.array(zod.unknown()),
})
export const CircleCheckoutSchema = zod.object({checkout: zod.object({path: zod.unknown()})})
export const CircleWhenStepHeaderSchema = zod.object({when: zod.unknown()})
export const CircleWhenStepSchema = zod.object({condition: zod.unknown(), steps: zod.array(zod.unknown())})
export const CircleRunHeaderSchema = zod.object({when: zod.unknown()})
export const CircleRunCommandSchema = zod.object({command: zod.string(), working_directory: zod.unknown()})

export const CircleSnykSettingsSchema = zod
  .object({
    'package-manager': zod.string().optional(),
    // Select the target only after establishing that the package manager is supported.
    'target-file': zod.unknown(),
    file: zod.unknown(),
  })
  .nullish()
  .transform((settings) => settings ?? {})
export const CircleSnykTargetSchema = zod.string().optional()

export type CircleJob = zod.infer<typeof CircleJobSchema>
