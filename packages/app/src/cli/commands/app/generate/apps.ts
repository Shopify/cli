import {appFlags} from '../../../flags.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {CreateAppOptions} from '../../../utilities/developer-platform-client.js'
import {Organization} from '../../../models/organization.js'
import {AppManagementClient} from '../../../utilities/developer-platform-client/app-management-client.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderTasks, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {Task} from '@shopify/cli-kit/node/ui'

interface BulkAppCreationResult {
  successful: string[]
  failed: {name: string; error: string}[]
}

export default class AppGenerateApps extends AppCommand {
  static summary = 'Generate multiple test apps in bulk for an organization.'

  static descriptionWithMarkdown = `Creates multiple apps programmatically in your organization. This is useful for testing scenarios that require a large number of apps.

  Each app will be created with:
  - A name following the pattern \`app-test-{number}\` (customizable with --prefix)
  - Basic configuration suitable for testing
  - No extensions or additional modules`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    count: Flags.integer({
      char: 'c',
      description: 'Number of apps to create',
      default: 1000,
      min: 1,
      max: 5000,
      env: 'SHOPIFY_FLAG_GENERATE_APPS_COUNT',
    }),
    prefix: Flags.string({
      char: 'p',
      description: 'Prefix for app names (apps will be named {prefix}-{number})',
      default: 'app-test',
      env: 'SHOPIFY_FLAG_GENERATE_APPS_PREFIX',
    }),
    'start-from': Flags.integer({
      description: 'Starting number for app naming',
      default: 1,
      min: 1,
      env: 'SHOPIFY_FLAG_GENERATE_APPS_START_FROM',
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be created without actually creating apps',
      default: false,
      env: 'SHOPIFY_FLAG_GENERATE_APPS_DRY_RUN',
    }),
    'stop-on-error': Flags.boolean({
      description: 'Stop creating apps if an error occurs',
      default: false,
      env: 'SHOPIFY_FLAG_GENERATE_APPS_STOP_ON_ERROR',
    }),
    'batch-size': Flags.integer({
      description: 'Number of apps to create in parallel',
      default: 5,
      min: 1,
      max: 20,
      env: 'SHOPIFY_FLAG_GENERATE_APPS_BATCH_SIZE',
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(AppGenerateApps)

    const {app, organization, developerPlatformClient} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    if (flags['dry-run']) {
      await this.performDryRun(flags, organization)
      return {app}
    }

    const result = await this.createBulkApps(flags, organization, developerPlatformClient as AppManagementClient)

    this.displayResults(result, flags)

    return {app}
  }

  private async performDryRun(flags: {[key: string]: unknown}, organization: Organization): Promise<void> {
    const appNames = this.generateAppNames(flags)

    outputInfo(`Dry run - would create the following apps:

Organization: ${organization.businessName}
Total apps: ${flags.count}
Batch size: ${flags['batch-size']}

First 10 app names:
${appNames
  .slice(0, 10)
  .map((name) => `  - ${name}`)
  .join('\n')}
${appNames.length > 10 ? `  ... and ${appNames.length - 10} more` : ''}`)
  }

  private generateAppNames(flags: {[key: string]: unknown}): string[] {
    const names: string[] = []
    const startFrom = flags['start-from'] as number
    const count = flags.count as number
    const prefix = flags.prefix as string

    for (let i = 0; i < count; i++) {
      names.push(`${prefix}-${startFrom + i}`)
    }

    return names
  }

  private async createBulkApps(
    flags: {[key: string]: unknown},
    organization: Organization,
    client: AppManagementClient,
  ): Promise<BulkAppCreationResult> {
    const appNames = this.generateAppNames(flags)
    const result: BulkAppCreationResult = {
      successful: [],
      failed: [],
    }

    const batchSize = flags['batch-size'] as number
    const totalBatches = Math.ceil(appNames.length / batchSize)

    const tasks: Task[] = []

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, appNames.length)
      const batch = appNames.slice(start, end)

      const batchNumber = batchIndex + 1
      tasks.push({
        title: `Creating apps batch ${batchNumber}/${totalBatches} (${batch.length} apps)`,
        task: async () => {
          const batchPromises = batch.map(async (name) => {
            try {
              const options: CreateAppOptions = {
                name,
                isLaunchable: false,
                scopesArray: [],
                isEmbedded: true,
              }

              await client.createApp(organization, options)
              result.successful.push(name)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              result.failed.push({name, error: errorMessage})

              if (flags['stop-on-error']) {
                throw new AbortError(`Failed to create app "${name}": ${errorMessage}`)
              }
            }
          })

          await Promise.all(batchPromises)
        },
      })
    }

    await renderTasks(tasks)

    return result
  }

  private displayResults(result: BulkAppCreationResult, flags: {[key: string]: unknown}): void {
    const total = result.successful.length + result.failed.length

    if (result.failed.length === 0) {
      renderSuccess({
        headline: 'All apps created successfully.',
        body: `Created ${result.successful.length} apps in total.`,
      })
    } else if (result.successful.length === 0) {
      renderWarning({
        headline: 'Failed to create any apps.',
        body: [
          `Attempted to create ${flags.count} apps but all failed.`,
          '',
          'First few errors:',
          ...result.failed.slice(0, 5).map((fail) => `  - ${fail.name}: ${fail.error}`),
          result.failed.length > 5 ? `  ... and ${result.failed.length - 5} more errors` : '',
        ],
      })
    } else {
      renderWarning({
        headline: 'Bulk app creation completed with some failures.',
        body: [
          `Successfully created: ${result.successful.length}/${total} apps`,
          `Failed: ${result.failed.length}/${total} apps`,
          '',
          'First few failures:',
          ...result.failed.slice(0, 5).map((fail) => `  - ${fail.name}: ${fail.error}`),
          result.failed.length > 5 ? `  ... and ${result.failed.length - 5} more failures` : '',
        ],
      })
    }
  }
}
