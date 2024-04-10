import {fetch} from './http.js'
import {JsonMap} from '../../private/common/json.js'
import {outputDebug, outputContent, outputToken} from '../../public/node/output.js'
import {DeepRequired} from '../common/ts/deep-required.js'

export {DeepRequired}

const url = 'https://monorail-edge.shopifysvc.com/v1/produce'

type Optional<T> = T | null

// This is the topic name of the main event we log to Monorail, the command tracker
export const MONORAIL_COMMAND_TOPIC = 'app_cli3_command/1.12' as const

export interface Schemas {
  [MONORAIL_COMMAND_TOPIC]: {
    sensitive: {
      args: string
      error_message?: Optional<string>
      app_name?: Optional<string>
      metadata?: Optional<string>
      store_fqdn?: Optional<string>
      cmd_all_environment_flags?: Optional<string>

      // Dev related commands
      cmd_dev_tunnel_custom?: Optional<string>

      // Environment
      env_plugin_installed_all?: Optional<string>
    }
    public: {
      partner_id?: Optional<number>
      command: string
      project_type?: Optional<string>
      time_start: number
      time_end: number
      total_time: number
      success: boolean
      api_key?: Optional<string>
      cli_version: string
      uname: string
      ruby_version: string
      node_version: string
      is_employee: boolean
      store_fqdn_hash?: Optional<string>

      // Any and all commands
      cmd_all_alias_used?: Optional<string>
      cmd_all_launcher?: Optional<string>
      cmd_all_path_override?: Optional<boolean>
      cmd_all_path_override_hash?: Optional<string>
      cmd_all_plugin?: Optional<string>
      cmd_all_topic?: Optional<string>
      cmd_all_verbose?: Optional<boolean>
      cmd_all_exit?: Optional<string>
      cmd_all_force?: Optional<boolean>

      cmd_all_timing_network_ms?: Optional<number>
      cmd_all_timing_prompts_ms?: Optional<number>
      cmd_all_timing_active_ms?: Optional<number>

      // Any extension related command
      cmd_extensions_binary_from_source?: Optional<boolean>

      // Scaffolding related commands
      cmd_scaffold_required_auth?: Optional<boolean>
      cmd_scaffold_template_custom?: Optional<boolean>
      cmd_scaffold_template_flavor?: Optional<string>
      cmd_scaffold_type?: Optional<string>
      cmd_scaffold_type_category?: Optional<string>
      cmd_scaffold_type_gated?: Optional<boolean>
      cmd_scaffold_type_owner?: Optional<string>
      cmd_scaffold_used_prompts_for_type?: Optional<boolean>

      // Used in several but not all commands
      cmd_app_dependency_installation_skipped?: Optional<boolean>
      cmd_app_reset_used?: Optional<boolean>
      cmd_app_linked_config_used?: Optional<boolean>
      cmd_app_linked_config_name?: Optional<string>
      cmd_app_linked_config_git_tracked?: Optional<boolean>
      cmd_app_all_configs_any?: Optional<boolean>
      cmd_app_all_configs_clients?: Optional<string>
      cmd_app_linked_config_source?: Optional<string>
      cmd_app_linked_config_uses_cli_managed_urls?: Optional<boolean>
      cmd_app_warning_api_key_deprecation_displayed?: Optional<boolean>
      cmd_app_deployment_mode?: Optional<string>

      // Dev related commands
      cmd_dev_tunnel_type?: Optional<string>
      cmd_dev_tunnel_custom_hash?: Optional<string>
      cmd_dev_urls_updated?: Optional<boolean>
      cmd_dev_preview_url_opened?: Optional<boolean>
      cmd_dev_graphiql_opened?: Optional<boolean>
      cmd_dev_dev_preview_toggle_used?: Optional<boolean>

      // Create-app related commands
      cmd_create_app_template?: Optional<string>
      cmd_create_app_template_url?: Optional<string>

      // Deploy related commands
      cmd_deploy_flag_message_used?: Optional<boolean>
      cmd_deploy_flag_version_used?: Optional<boolean>
      cmd_deploy_flag_source_url_used?: Optional<boolean>
      cmd_deploy_confirm_new_registrations?: Optional<number>
      cmd_deploy_confirm_updated_registrations?: Optional<number>
      cmd_deploy_confirm_removed_registrations?: Optional<number>
      cmd_deploy_confirm_cancelled?: Optional<boolean>
      cmd_deploy_confirm_time_to_complete_ms?: Optional<number>
      cmd_deploy_prompt_upgrade_to_unified_displayed?: Optional<boolean>
      cmd_deploy_prompt_upgrade_to_unified_response?: Optional<string>
      cmd_deploy_confirm_include_config_used?: Optional<boolean>
      cmd_deploy_include_config_used?: Optional<boolean>
      cmd_deploy_config_modules_breakdown?: Optional<string>
      cmd_deploy_config_modules_updated?: Optional<string>
      cmd_deploy_config_modules_added?: Optional<string>
      cmd_deploy_config_modules_deleted?: Optional<string>

      // Release related commands
      cmd_release_confirm_cancelled?: Optional<boolean>

      // App setup
      app_extensions_any?: Optional<boolean>
      app_extensions_breakdown?: Optional<string>
      app_extensions_count?: Optional<number>
      app_extensions_custom_layout?: Optional<boolean>
      app_extensions_function_any?: Optional<boolean>
      app_extensions_function_count?: Optional<number>
      app_extensions_function_custom_layout?: Optional<boolean>
      app_extensions_theme_any?: Optional<boolean>
      app_extensions_theme_count?: Optional<number>
      app_extensions_theme_custom_layout?: Optional<boolean>
      app_extensions_ui_any?: Optional<boolean>
      app_extensions_ui_count?: Optional<number>
      app_extensions_ui_custom_layout?: Optional<boolean>
      app_name_hash?: Optional<string>
      app_path_hash?: Optional<string>
      app_scopes?: Optional<string>
      app_web_backend_any?: Optional<boolean>
      app_web_backend_count?: Optional<number>
      app_web_custom_layout?: Optional<boolean>
      app_web_framework?: Optional<string>
      app_web_frontend_any?: Optional<boolean>
      app_web_frontend_count?: Optional<number>

      // Environment
      env_ci?: Optional<boolean>
      env_ci_platform?: Optional<string>
      env_device_id?: Optional<string>
      env_package_manager?: Optional<string>
      env_package_manager_workspaces?: Optional<boolean>
      env_plugin_installed_any_custom?: Optional<boolean>
      env_plugin_installed_shopify?: Optional<string>
      env_shell?: Optional<string>
      env_web_ide?: Optional<string>
      env_cloud?: Optional<string>
      env_is_global?: Optional<boolean>
    }
  }
  [schemaId: string]: {sensitive: JsonMap; public: JsonMap}
}

// In reality, we're normally most interested in just this from Schemas, so export it for ease of use.
// The monorail schema itself has lots of optional values as it must be backwards-compatible. For our schema we want mandatory values instead.
export type MonorailEventPublic = DeepRequired<Schemas[typeof MONORAIL_COMMAND_TOPIC]['public']>
export type MonorailEventSensitive = Schemas[typeof MONORAIL_COMMAND_TOPIC]['sensitive']

type MonorailResult = {type: 'ok'} | {type: 'error'; message: string}

const publishedCommandNames = new Set<string>()

/**
 * Publishes an event to Monorail.
 *
 * @param schemaId - The schema ID of the event to publish.
 * @param publicData - The public data to publish.
 * @param sensitiveData - The sensitive data to publish.
 * @returns A result indicating whether the event was successfully published.
 */
export async function publishMonorailEvent<TSchemaId extends keyof Schemas, TPayload extends Schemas[TSchemaId]>(
  schemaId: TSchemaId,
  publicData: TPayload['public'],
  sensitiveData: TPayload['sensitive'],
): Promise<MonorailResult> {
  // If a command has already been logged, never re-log it. This is to prevent duplication caused by unexpected errors.
  const commandName = publicData.command
  if (commandName && typeof commandName === 'string') {
    if (publishedCommandNames.has(commandName)) {
      return {type: 'ok'}
    }
    publishedCommandNames.add(commandName)
  }

  try {
    const currentTime = new Date().getTime()
    const payload = {...publicData, ...sensitiveData}
    const body = JSON.stringify({schema_id: schemaId, payload})
    const headers = buildHeaders(currentTime)

    const response = await fetch(url, {method: 'POST', body, headers})

    if (response.status === 200) {
      outputDebug(outputContent`Analytics event sent: ${outputToken.json(sanitizePayload(payload))}`)
      return {type: 'ok'}
    } else {
      outputDebug(`Failed to report usage analytics: ${response.statusText}`)
      return {type: 'error', message: response.statusText}
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    outputDebug(message)
    return {type: 'error', message}
  }
}

/**
 * Sanitizies the api_key from the payload and returns a new hash.
 *
 * @param payload - The public and sensitive data.
 * @returns A copy of the payload with the api_key sanitized.
 */
function sanitizePayload<T extends object>(payload: T): T {
  const result = {...payload}
  if ('api_key' in result) {
    result.api_key = '****'
  }

  return result
}

const buildHeaders = (currentTime: number) => {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': currentTime.toString(),
    'X-Monorail-Edge-Event-Sent-At-Ms': currentTime.toString(),
  }
}
