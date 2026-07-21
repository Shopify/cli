import {buildReportInstructions} from './prompt.js'
import {createProxyRunner} from './client.js'
import {createReportTools, type ReportToolExecutors} from './tools.js'
import {Agent, MCPServerStdio} from '@openai/agents'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileURLToPath} from 'node:url'
import type {AdminStoreGraphQLContext} from './execute.js'
import type {ReportQueryRecord, StoreReportApi} from './types.js'

// A single run can involve several exploratory queries; give the loop plenty of room to confirm
// syntax with the dev docs tools and self-correct before it has to give up.
const MAX_TURNS = 25

export interface ReportAgentInput {
  context: AdminStoreGraphQLContext
  question: string
  proxyBaseUrl: string
  proxyToken: string
  model: string
}

export interface ReportAgentResult {
  api: StoreReportApi
  query: string
  result: unknown
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

/**
 * The real agent loop: points the OpenAI Agents SDK at Shopify's internal LLM proxy (Chat
 * Completions, tracing off), mounts the Shopify dev-mcp server over stdio for docs/schema
 * knowledge, and runs it streamed so its progress prints to stderr. Returns the model's final
 * output; the ground-truth query results are captured separately via the tools' accumulator.
 *
 * The client, provider, and runner are scoped locally (rather than set as SDK process-globals) so
 * concurrent runs and tests never share mutable global state.
 */
async function runRealAgentLoop(params: RunAgentLoopParams): Promise<string> {
  const runner = createProxyRunner(params)

  const devMcp = new MCPServerStdio({name: 'shopify-dev-mcp', command: 'node', args: [resolveDevMcpEntry()]})
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
    result.toTextStream({compatibleWithNodeStreams: true}).pipe(process.stderr)
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
 * of truth: its LAST successful query is the answer, and the model's final output is the summary.
 * If no query ever succeeded the accumulator is empty, so there is no answer to return — surface the
 * model's explanation as an error instead.
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
  })

  const lastSuccessfulQuery = accumulator.at(-1)
  if (!lastSuccessfulQuery) {
    throw new AbortError(
      'The report agent finished without successfully running any query.',
      summary === '' ? undefined : summary,
    )
  }

  return {
    api: lastSuccessfulQuery.api,
    query: lastSuccessfulQuery.query,
    result: lastSuccessfulQuery.result,
    summary,
  }
}
