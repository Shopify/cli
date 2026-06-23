import {loadConfig} from '../../../services/flow/project-config.js'
import {dispatchFlowTool, unwrapJsonResult} from '../../../services/flow/dispatch.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

const TASK_TYPES = ['trigger', 'action', 'condition', 'foreach', 'wait'] as const
type TaskTypeFilter = (typeof TASK_TYPES)[number]

interface RawTask {
  id: string
  version: string
  label: string
  description?: string
  task_type: string
  connector_id?: string
  installed?: boolean
  publisher?: string
}

interface RawTaskSearchResult {
  tasks: Record<string, RawTask[]>
}

interface FlatTask extends RawTask {
  matched_queries: string[]
}

interface SearchResult {
  store: string
  total: number
  tasks: FlatTask[]
  by_query: Record<string, RawTask[]>
}

export default class FlowTaskSearch extends StoreCommand {
  static hidden = true

  static summary = 'Search Flow tasks (triggers, conditions, actions, etc.).'

  static descriptionWithMarkdown = `Finds Flow tasks (triggers, conditions, actions, foreach, wait) by natural-language query. Pass each goal as a separate positional argument.

Returns task references (id + version) you can pass to \`flow task describe\` to get the full configuration schema.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> "order created trigger"',
    '<%= config.bin %> <%= command.id %> "add order tags" "send email"',
    '<%= config.bin %> <%= command.id %> "tagging" --type action',
  ]

  static args = {
    query: Args.string({description: 'Search query (one or more, space-separated).', required: true}),
  }

  static strict = false

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain. Falls back to flow.toml.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    type: Flags.string({
      description: 'Filter by task type.',
      options: [...TASK_TYPES],
    }),
  }

  public async run(): Promise<void> {
    const {argv, flags} = await this.parse(FlowTaskSearch)
    const queries = argv as string[]

    if (queries.length === 0) throw new AbortError('At least one search query is required.')

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const response = await dispatchFlowTool({
      name: 'flow_app_agent_task_search',
      source: 'flow',
      store,
      args: {search_queries: queries},
    })

    const raw = unwrapJsonResult<RawTaskSearchResult>(response)
    const result = shapeResult(store, raw, flags.type as TaskTypeFilter | undefined)

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
      return
    }

    outputResult(formatHuman(result))
  }
}

function shapeResult(store: string, raw: RawTaskSearchResult, typeFilter: TaskTypeFilter | undefined): SearchResult {
  const byId = new Map<string, FlatTask>()
  const byQuery: Record<string, RawTask[]> = {}

  const wantedType = typeFilter?.toUpperCase()

  for (const [query, tasks] of Object.entries(raw.tasks ?? {})) {
    const filtered = wantedType ? tasks.filter((task) => task.task_type === wantedType) : tasks
    byQuery[query] = filtered

    for (const task of filtered) {
      const key = `${task.id}@${task.version}`
      const existing = byId.get(key)
      if (existing) {
        if (!existing.matched_queries.includes(query)) existing.matched_queries.push(query)
      } else {
        byId.set(key, {...task, matched_queries: [query]})
      }
    }
  }

  const tasks = [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))
  return {store, total: tasks.length, tasks, by_query: byQuery}
}

function formatHuman(result: SearchResult): string {
  if (result.tasks.length === 0) return `No tasks matched on ${result.store}.`

  const idWidth = Math.max(2, ...result.tasks.map((task) => `${task.id}@${task.version}`.length))
  const typeWidth = Math.max(4, ...result.tasks.map((task) => task.task_type.length))
  const pubWidth = Math.max(3, ...result.tasks.map((task) => (task.publisher ?? '?').length))
  const labelWidth = Math.max(5, ...result.tasks.map((task) => task.label.length))

  const lines = [
    `${'TYPE'.padEnd(typeWidth)}  ${'PUB'.padEnd(pubWidth)}  ${'ID@VERSION'.padEnd(idWidth)}  ${'LABEL'.padEnd(
      labelWidth,
    )}`,
    ...result.tasks.map(
      (task) =>
        `${task.task_type.padEnd(typeWidth)}  ${(task.publisher ?? '?').padEnd(pubWidth)}  ${`${task.id}@${task.version}`
          .padEnd(idWidth)}  ${task.label.padEnd(labelWidth)}`,
    ),
  ]

  return lines.join('\n')
}
