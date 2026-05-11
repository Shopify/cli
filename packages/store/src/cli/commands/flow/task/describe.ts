import {loadConfig} from '../../../services/flow/project-config.js'
import {dispatchFlowTool, unwrapJsonResult} from '../../../services/flow/dispatch.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

interface TaskRef {
  id: string
  version: string
}

interface TaskConfiguration {
  id: string
  version: string
  task_type: string
  input_port_id?: string
  output_port_ids?: string[]
  config_fields: unknown[]
  return_fields: unknown[]
  config_instructions?: Record<string, unknown>
  error?: string
}

interface TaskConfigurationResponse {
  tasks: TaskConfiguration[]
}

function parseTaskRef(input: string): TaskRef {
  const at = input.lastIndexOf('@')
  if (at === -1) {
    throw new AbortError(
      `Invalid task reference "${input}".`,
      'Use the form `<id>@<version>`, e.g. `shopify::admin::order_created@0.1`.',
    )
  }
  const id = input.slice(0, at)
  const version = input.slice(at + 1)
  if (!id || !version) {
    throw new AbortError(`Invalid task reference "${input}".`, 'Both id and version are required.')
  }
  return {id, version}
}

interface ConfigField {
  id?: string
  label?: string
  description?: string
  default_value?: string
  validations?: {id?: string; options?: Record<string, unknown>; error_message?: string}[]
  possible_object_types?: string[]
  supports_liquid?: boolean
}

function formatHuman(tasks: TaskConfiguration[]): string {
  return tasks.map(formatTask).join('\n\n---\n\n')
}

function formatTask(task: TaskConfiguration): string {
  const lines: string[] = []
  lines.push(`${task.id}@${task.version}  (${task.task_type})`)
  if (task.error) {
    lines.push(`  error: ${task.error}`)
    return lines.join('\n')
  }
  if (task.input_port_id) lines.push(`  input port:   ${task.input_port_id}`)
  if (task.output_port_ids?.length) lines.push(`  output ports: ${task.output_port_ids.join(', ')}`)

  if (task.config_fields.length === 0) {
    lines.push('  config fields: (none)')
  } else {
    lines.push('  config fields:')
    for (const field of task.config_fields as ConfigField[]) {
      const wrapHint = needsValueWrapper(field) ? '  [wrap value: {"value": "...", "default_value": ""}]' : ''
      const liquidHint = field.supports_liquid ? '  [supports Liquid]' : ''
      lines.push(`    - ${field.id ?? '?'}${field.label ? ` — ${field.label}` : ''}${wrapHint}${liquidHint}`)
      if (field.description) lines.push(`        ${field.description}`)
    }
  }

  if (task.return_fields.length === 0) {
    lines.push('  return fields: (none)')
  } else {
    lines.push(`  return fields: ${task.return_fields.length}  (use --json for full schema)`)
  }

  return lines.join('\n')
}

function needsValueWrapper(field: ConfigField): boolean {
  return Boolean(field.validations?.some((validation) => (validation.options as {subfield?: string})?.subfield === 'value'))
}

export default class FlowTaskDescribe extends StoreCommand {
  static summary = 'Describe one or more Flow tasks: configuration and return schemas.'

  static descriptionWithMarkdown = `Returns the full configuration schema and return-field definitions for one or more Flow tasks.

Each task is identified as \`<id>@<version>\` (e.g. \`shopify::admin::order_created@0.1\`).`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> shopify::admin::order_created@0.1',
    '<%= config.bin %> <%= command.id %> shopify::admin::order_created@0.1 shopify::admin::add_order_tags@0.1',
  ]

  static args = {
    task: Args.string({
      description: 'Task reference as `<id>@<version>` (one or more).',
      required: true,
    }),
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
  }

  public async run(): Promise<void> {
    const {argv, flags} = await this.parse(FlowTaskDescribe)
    const refs = (argv as string[]).map(parseTaskRef)

    if (refs.length === 0) throw new AbortError('At least one task reference is required.')

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const response = await dispatchFlowTool({
      name: 'flow_app_agent_task_configuration',
      source: 'flow',
      store,
      args: {tasks: refs},
    })

    const raw = unwrapJsonResult<TaskConfigurationResponse>(response)
    const tasks = raw.tasks ?? []

    if (flags.json) {
      outputResult(JSON.stringify({tasks}, null, 2))
      return
    }

    outputResult(formatHuman(tasks))
  }
}
