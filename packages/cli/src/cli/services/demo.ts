import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'
import {
  renderFatalError,
  renderInfo,
  renderSuccess,
  renderTable,
  renderConcurrent,
  renderTasks,
  renderWarning,
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderSelectPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

import {zod} from '@shopify/cli-kit/node/schema'

const linkSchema = zod.object({label: zod.string(), url: zod.string()})
const inlineTokenSchema = zod.union([
  zod.string(),
  zod.object({command: zod.string()}),
  zod.object({link: linkSchema}),
  zod.object({char: zod.string().length(1)}),
  zod.object({userInput: zod.string()}),
  zod.object({subdued: zod.string()}),
  zod.object({filePath: zod.string()}),
  zod.object({bold: zod.string()}),
])
const headlineTokenSchema = zod.union([
  zod.string(),
  zod.object({command: zod.string()}),
  zod.object({char: zod.string().length(1)}),
  zod.object({userInput: zod.string()}),
  zod.object({subdued: zod.string()}),
  zod.object({filePath: zod.string()}),
])
// type InlineToken = zod.infer<typeof inlineTokenSchema>
function oneOrMore<T>(singular: zod.ZodType<T>) {
  return zod.union([singular, zod.array(singular)])
}
const inlineTokenItemSchema = oneOrMore(inlineTokenSchema)
// type InlineTokenItem = zod.infer<typeof inlineTokenItemSchema>
const listSchema = zod.object({
  list: zod.object({
    title: zod.string(),
    items: zod.array(inlineTokenItemSchema),
    ordered: zod.boolean().optional()
  })
})
const tokenItemSchema = oneOrMore(zod.union([inlineTokenSchema, listSchema]))

const tableSchema = zod.object({
  rows: zod.array(zod.object({}).catchall(zod.string())),
  columns: zod.object({}).catchall(zod.object({
    header: zod.string().optional(),
    color: zod.string().optional(),
  })),
})
const infoTableSchema = zod.union([
  zod.object({}).catchall(zod.array(inlineTokenItemSchema)),
  zod.object({
    color: zod.string().optional(),
    header: zod.string(),
    helperText: zod.string().optional(),
    items: zod.array(inlineTokenItemSchema),
  }),
])

const abstractDemoStepSchema = zod.object({
  type: zod.string(),
  properties: zod.object({}),
})

const outputStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('output'),
  properties: zod.object({
    content: zod.string(),
  }),
})
type OutputStep = zod.infer<typeof outputStepSchema>

const renderStepPropertiesSchema = zod.object({
  headline: headlineTokenSchema.optional(),
  body: tokenItemSchema.optional(),
  nextSteps: zod.array(inlineTokenItemSchema).optional(),
  reference: zod.array(inlineTokenItemSchema).optional(),
  link: linkSchema.optional(),
  customSections: zod.array(zod.object({
    title: zod.string().optional(),
    body: inlineTokenItemSchema,
  })).optional(),
  orderedNextSteps: zod.boolean().optional(),
})
const renderInfoStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('info'),
  properties: renderStepPropertiesSchema,
})
type RenderInfoStep = zod.infer<typeof renderInfoStepSchema>
const renderSuccessStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('success'),
  properties: renderStepPropertiesSchema,
})
type RenderSuccessStep = zod.infer<typeof renderSuccessStepSchema>
const renderWarningStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('warning'),
  properties: renderStepPropertiesSchema,
})
type RenderWarningStep = zod.infer<typeof renderWarningStepSchema>

const renderFatalErrorStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('fatalError'),
  properties: zod.object({
    errorType: zod.union([zod.literal('abort'), zod.literal('bug')]),
    message: zod.string(),
    tryMessage: zod.string().optional(),
    nextSteps: zod.array(inlineTokenItemSchema).optional(),
  }),
})
type RenderFatalErrorStep = zod.infer<typeof renderFatalErrorStepSchema>

const renderTableStepSchema = zod.object({
  type: zod.literal('table'),
  properties: tableSchema,
})
type RenderTableStep = zod.infer<typeof renderTableStepSchema>

const renderAutoCompletePromptStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('autocompletePrompt'),
  properties: zod.object({
    message: zod.string(),
    choices: zod.array(zod.object({
      label: zod.string(),
      value: zod.string(),
    })),
  }),
})
type RenderAutocompletePromptStep = zod.infer<typeof renderAutoCompletePromptStepSchema>

const renderConfirmationPromptStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('confirmationPrompt'),
  properties: zod.object({
    message: zod.string(),
    infoTable: infoTableSchema.optional(),
    confirmationMessage: zod.string(),
    cancellationMessage: zod.string(),
  }),
})
type RenderConfirmationPromptStep = zod.infer<typeof renderConfirmationPromptStepSchema>

const renderSelectPromptStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('selectPrompt'),
  properties: zod.object({
    message: zod.string(),
    choices: zod.array(zod.object({
      label: zod.string(),
      value: zod.string(),
    })),
    infoTable: infoTableSchema.optional(),
  }),
})
type RenderSelectPromptStep = zod.infer<typeof renderSelectPromptStepSchema>

const renderTextPromptStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('textPrompt'),
  properties: zod.object({
    message: zod.string(),
    defaultValue: zod.string().optional(),
    password: zod.boolean().optional(),
    allowEmpty: zod.boolean().optional(),
  }),
})
type RenderTextPromptStep = zod.infer<typeof renderTextPromptStepSchema>

const sleepStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('sleep'),
  properties: zod.object({
    duration: zod.number(),
  }),
})
type SleepStep = zod.infer<typeof sleepStepSchema>

const taskbarStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('taskbar'),
  properties: zod.object({
    steps: zod.array(zod.object({
      title: zod.string(),
      duration: zod.number(),
    })),
  }),
})
type TaskbarStep = zod.infer<typeof taskbarStepSchema>

const renderConcurrentPropertiesSchema = zod.object({
  processes: zod.array(zod.object({
    prefix: zod.string(),
    steps: zod.array(zod.object({
      startMessage: zod.string().optional(),
      duration: zod.number(),
      endMessage: zod.string().optional(),
    })),
  })),
  footer: zod.object({
    shortcuts: zod.array(zod.object({
      key: zod.string(),
      action: zod.string(),
    })),
    subTitle: zod.string().optional(),
  }).optional(),
})
type RenderConcurrentProperties = zod.infer<typeof renderConcurrentPropertiesSchema>
const renderConcurrentStepSchema = abstractDemoStepSchema.extend({
  type: zod.literal('concurrent'),
  properties: renderConcurrentPropertiesSchema,
})
type RenderConcurrentStep = zod.infer<typeof renderConcurrentStepSchema>

type DemoStep =
  OutputStep
  | RenderInfoStep
  | RenderSuccessStep
  | RenderWarningStep
  | RenderTableStep
  | RenderFatalErrorStep
  | RenderAutocompletePromptStep
  | RenderConfirmationPromptStep
  | RenderSelectPromptStep
  | RenderTextPromptStep
  | SleepStep
  | TaskbarStep
  | RenderConcurrentStep

const demoStepSchema = zod.discriminatedUnion('type', [
  outputStepSchema,
  renderInfoStepSchema,
  renderSuccessStepSchema,
  renderWarningStepSchema,
  renderTableStepSchema,
  renderFatalErrorStepSchema,
  renderAutoCompletePromptStepSchema,
  renderConfirmationPromptStepSchema,
  renderSelectPromptStepSchema,
  renderTextPromptStepSchema,
  sleepStepSchema,
  taskbarStepSchema,
  renderConcurrentStepSchema,
])
export const demoStepsSchema = zod.object({
  steps: zod.array(demoStepSchema),
})
type DemoSteps = zod.infer<typeof demoStepsSchema>

export async function demo(stepsJsonData: DemoSteps) {
  const {steps} = demoStepsSchema.parse(stepsJsonData)
  const executors = steps.map(executorForStep)
  for (const executor of executors) {
    await executor()
  }
}

function executorForStep(step: DemoStep): () => Promise<void> {
  switch (step.type) {
    case 'output':
      return async () => { outputInfo(step.properties.content) }
    case 'sleep':
      return async () => { await sleep(step.properties.duration) }
    case 'taskbar':
      return taskbarExecutor(step.properties.steps)
    case 'concurrent':
      return concurrentExecutor(step.properties)
    case 'info':
      return async () => { renderInfo(step.properties) }
    case 'success':
      return async () => { renderSuccess(step.properties) }
    case 'warning':
      return async () => { renderWarning(step.properties) }
    case 'fatalError':
      return async () => {
        const {errorType, message, nextSteps, tryMessage} = step.properties
        if (errorType === 'abort') {
          renderFatalError(new AbortError(message, tryMessage, nextSteps))
        } else {
          renderFatalError(new BugError(message, tryMessage))
        }
      }
    case 'table':
      return async () => { renderTable(step.properties as Parameters<typeof renderTable>[0]) }
    case 'autocompletePrompt':
      return async () => { await renderAutocompletePrompt(step.properties) }
    case 'confirmationPrompt':
      return async () => { await renderConfirmationPrompt(step.properties as Parameters<typeof renderConfirmationPrompt>[0]) }
    case 'selectPrompt':
      return async () => { await renderSelectPrompt(step.properties as Parameters<typeof renderSelectPrompt>[0]) }
    case 'textPrompt':
      return async () => { await renderTextPrompt(step.properties) }
    default:
      throw new Error(`Unknown step type: ${(step as any).type}`)
  }
}

function taskbarExecutor(steps: {title: string, duration: number}[]) {
  return async () => {
    const tasks = steps.map(({title, duration}) => {
      return {
        title,
        task: async () => await sleep(duration),
      }
    })
    await renderTasks(tasks)
  }
}

function concurrentExecutor({processes, footer}: RenderConcurrentProperties) {
  return async () => {
    const concurrentProcesses = processes.map(({prefix, steps}) => {
      return {
        prefix,
        action: async (stdout: Writable) => {
          for (const step of steps) {
            const {startMessage, duration, endMessage} = step
            if (startMessage) stdout.write(startMessage)
            await sleep(duration)
            if (endMessage) stdout.write(endMessage)
          }
        }
      }
    })
    await renderConcurrent({processes: concurrentProcesses, footer})
  }
}
