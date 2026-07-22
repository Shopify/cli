import {buildReportInstructions} from './prompt.js'
import {createProxyRunner} from './client.js'
import {buildDevMcpLaunch} from './dev-mcp-launch.js'
import {isStoreQueryTool, queryingTitle, REPORT_PROGRESS_TITLES, type ReportProgress} from './progress.js'
import {createReportTools, type ReportToolExecutors} from './tools.js'
import {Agent, MCPServerStdio} from '@openai/agents'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {fileURLToPath} from 'node:url'
import type {RunItem, RunStreamEvent} from '@openai/agents'
import type {AdminStoreGraphQLContext} from './execute.js'
import type {ReportQueryRecord} from './types.js'

// A single run can involve several exploratory queries; give the loop plenty of room to confirm
// syntax with the dev docs tools and self-correct before it has to give up.
const MAX_TURNS = 25

export interface ReportAgentInput {
  context: AdminStoreGraphQLContext
  question: string
  proxyBaseUrl: string
  proxyToken: string
  model: string
  onProgress?: ReportProgress
}

export interface ReportAgentResult {
  queries: ReportQueryRecord[]
  summary: string
}

export interface RunAgentLoopParams {
  instructions: string
  model: string
  tools: ReturnType<typeof createReportTools>
  question: string
  proxyBaseUrl: string
  proxyToken: string
  maxTurns: number
  onProgress?: ReportProgress
}

/**
 * Dependencies of the agent run. `runAgentLoop` is the one seam that actually talks to the model
 * and spawns the dev-mcp server; tests replace it with a fake that invokes the tools and returns a
 * canned summary, so no network or child process is touched. `executors` are threaded through to
 * the tools so those same tests can return canned query outcomes.
 */
export interface ReportAgentDependencies {
  runAgentLoop: (params: RunAgentLoopParams) => Promise<string>
  executors?: ReportToolExecutors
}

// Resolve the locally-installed dev-mcp entry point so we can spawn it directly (rather than via
// `npx`, which would re-download it and stall the stdio handshake). dev-mcp's package `exports`
// only expose the `import` condition, so `createRequire(...).resolve()` is blocked — `import.meta`
// resolution honors that condition and returns the `dist/index.js` file URL.
function resolveDevMcpEntry(): string {
  return fileURLToPath(import.meta.resolve('@shopify/dev-mcp'))
}

/** Reads a tool call's name off its raw item, if the shape has one (not every tool-call kind does). */
function extractToolName(item: RunItem): string | undefined {
  const rawItem = (item as {rawItem?: unknown}).rawItem
  if (typeof rawItem !== 'object' || rawItem === null) return undefined

  const name = (rawItem as {name?: unknown}).name
  return typeof name === 'string' ? name : undefined
}

/** Joins the `output_text` parts of an assistant message item's raw content, if any are present. */
function extractMessageText(item: RunItem): string | undefined {
  const rawItem = (item as {rawItem?: unknown}).rawItem
  if (typeof rawItem !== 'object' || rawItem === null) return undefined

  const content = (rawItem as {content?: unknown}).content
  if (!Array.isArray(content)) return undefined

  const text = content
    .filter(
      (part): part is {text: string} =>
        typeof part === 'object' &&
        part !== null &&
        (part as {type?: unknown}).type === 'output_text' &&
        typeof (part as {text?: unknown}).text === 'string',
    )
    .map((part) => part.text)
    .join('')

  return text === '' ? undefined : text
}

/**
 * Drives `onProgress` off one streamed event and, for assistant messages, debug-logs the narration.
 * `extractToolName`/`extractMessageText` are already fully defensive about the event/item shape (they
 * only ever read through `typeof`/`Array.isArray` checks), so there's nothing here that can throw over
 * a change in the SDK's stream shape.
 */
function handleStreamEvent(
  event: RunStreamEvent,
  onProgress: ReportProgress | undefined,
  state: {queryCount: number},
): void {
  if (event.type !== 'run_item_stream_event') return

  if (event.name === 'tool_called') {
    const toolName = extractToolName(event.item)
    if (toolName !== undefined && isStoreQueryTool(toolName)) {
      state.queryCount += 1
      onProgress?.(queryingTitle(state.queryCount))
    } else {
      onProgress?.(REPORT_PROGRESS_TITLES.consultingDocs)
    }
    return
  }

  if (event.name === 'reasoning_item_created') {
    onProgress?.(REPORT_PROGRESS_TITLES.analyzing)
    return
  }

  if (event.name === 'message_output_created') {
    onProgress?.(REPORT_PROGRESS_TITLES.analyzing)
    const text = extractMessageText(event.item)
    if (text !== undefined) outputDebug(text)
  }
}

/**
 * The real agent loop: points the OpenAI Agents SDK at Shopify's internal LLM proxy (Chat
 * Completions, tracing off), mounts the Shopify dev-mcp server over stdio for docs/schema
 * knowledge, and runs it streamed, driving `onProgress` off the streamed events and routing the
 * model's narration to the debug log (visible under `--verbose`) instead of stderr. Returns the
 * model's final output; the ground-truth query results are captured separately via the tools'
 * accumulator.
 *
 * The client, provider, and runner are scoped locally (rather than set as SDK process-globals) so
 * concurrent runs and tests never share mutable global state.
 */
async function runRealAgentLoop(params: RunAgentLoopParams): Promise<string> {
  const runner = createProxyRunner(params)

  const {command, args} = buildDevMcpLaunch(resolveDevMcpEntry())
  const devMcp = new MCPServerStdio({name: 'shopify-dev-mcp', command, args})
  await devMcp.connect()

  try {
    const agent = new Agent({
      name: 'Store Report Agent',
      instructions: params.instructions,
      model: params.model,
      tools: Object.values(params.tools),
      mcpServers: [devMcp],
    })

    const result = await runner.run(agent, params.question, {stream: true, maxTurns: params.maxTurns})

    const state = {queryCount: 0}
    for await (const event of result) {
      handleStreamEvent(event, params.onProgress, state)
    }
    await result.completed

    return typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput ?? '')
  } finally {
    await devMcp.close()
  }
}

const defaultReportAgentDependencies: ReportAgentDependencies = {
  runAgentLoop: runRealAgentLoop,
}

/**
 * Runs the report agent loop and derives a structured answer from it. The accumulator is the source
 * of truth: every successful query it recorded, in call order, is surfaced as the answer, and the
 * model's final output is the summary. If no query ever succeeded the accumulator is empty, so there
 * is no answer to return — surface the model's explanation as an error instead.
 */
export async function runReportAgent(
  input: ReportAgentInput,
  dependencies: Partial<ReportAgentDependencies> = {},
): Promise<ReportAgentResult> {
  const deps = {...defaultReportAgentDependencies, ...dependencies}

  const accumulator: ReportQueryRecord[] = []
  const tools = createReportTools(input.context, accumulator, deps.executors)

  const summary = await deps.runAgentLoop({
    instructions: buildReportInstructions(),
    model: input.model,
    tools,
    question: input.question,
    proxyBaseUrl: input.proxyBaseUrl,
    proxyToken: input.proxyToken,
    maxTurns: MAX_TURNS,
    onProgress: input.onProgress,
  })

  if (accumulator.length === 0) {
    throw new AbortError(
      'The report agent finished without successfully running any query.',
      summary === '' ? undefined : summary,
    )
  }

  return {
    queries: [...accumulator],
    summary,
  }
}
