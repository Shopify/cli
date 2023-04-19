import {outputInfo} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'
import {
  renderFatalError,
  renderInfo,
  renderSuccess,
  renderTable,
  renderTasks,
  renderWarning,
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderSelectPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'

interface AbstractDemoStep {
  type: string
  properties: any
}

interface OutputStep extends AbstractDemoStep {
  type: 'output'
  properties: {
    content: string
  }
}

interface RenderStep extends AbstractDemoStep {
  type: 'info' | 'success' | 'warning'
  properties: Parameters<typeof renderInfo>[0]
}

interface RenderFatalErrorStep extends AbstractDemoStep {
  type: 'fatalError'
  properties: Parameters<typeof renderFatalError>
}

interface RenderTableStep extends AbstractDemoStep {
  type: 'table'
  properties: Parameters<typeof renderTable>[0]
}

interface RenderAutocompletePromptStep extends AbstractDemoStep {
  type: 'autocompletePrompt'
  properties: Parameters<typeof renderAutocompletePrompt>[0]
}

interface RenderConfirmationPromptStep extends AbstractDemoStep {
  type: 'confirmationPrompt'
  properties: Parameters<typeof renderConfirmationPrompt>[0]
}

interface RenderSelectPromptStep extends AbstractDemoStep {
  type: 'selectPrompt'
  properties: Parameters<typeof renderSelectPrompt>[0]
}

interface RenderTextPromptStep extends AbstractDemoStep {
  type: 'textPrompt'
  properties: Parameters<typeof renderTextPrompt>[0]
}

interface SleepStep extends AbstractDemoStep {
  type: 'sleep'
  properties: {
    duration: number
  }
}

interface TaskbarStep extends AbstractDemoStep {
  type: 'taskbar'
  properties: {
    steps: {
      title: string
      duration: number
    }[]
  }
}

type DemoStep =
  OutputStep
  | RenderStep
  | RenderTableStep
  | RenderFatalErrorStep
  | RenderAutocompletePromptStep
  | RenderConfirmationPromptStep
  | RenderSelectPromptStep
  | RenderTextPromptStep
  | SleepStep
  | TaskbarStep

interface DemoSteps {
  steps: DemoStep[]
}

export async function demo({steps}: DemoSteps) {
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
    case 'info':
      return async () => { renderInfo(step.properties) }
    case 'success':
      return async () => { renderSuccess(step.properties) }
    case 'warning':
      return async () => { renderWarning(step.properties) }
    case 'fatalError':
      return async () => { renderFatalError(...step.properties) }
    case 'table':
      return async () => { renderTable(step.properties) }
    case 'autocompletePrompt':
      return async () => { await renderAutocompletePrompt(step.properties) }
    case 'confirmationPrompt':
      return async () => { await renderConfirmationPrompt(step.properties) }
    case 'selectPrompt':
      return async () => { await renderSelectPrompt(step.properties) }
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
        task: () => sleep(duration),
      }
    })
    await renderTasks(tasks)
  }
}
