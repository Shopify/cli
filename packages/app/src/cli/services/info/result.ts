import {AppInfoResult, appInfoJsonOutputSchema} from './types.js'
import {AppLinkedInterface, getAppScopes} from '../../models/app/app.js'
import {Project} from '../../models/project/project.js'
import {configurationFileNames} from '../../constants.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {Organization, OrganizationApp} from '../../models/organization.js'
import {isServiceAccount, isUserAccount, AccountInfo} from '@shopify/cli-kit/node/session'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {basename, relativePath} from '@shopify/cli-kit/node/path'
import {
  OutputMessage,
  outputResult,
  outputToken,
  formatPackageManagerCommand,
  outputContent,
  shouldDisplayColors,
} from '@shopify/cli-kit/node/output'
import {AlertCustomSection, InlineToken, renderInfo} from '@shopify/cli-kit/node/ui'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {getArrayRejectingUndefined, uniq} from '@shopify/cli-kit/common/array'

interface InfoContext {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  organization: Organization
  project: Project
}

export async function formatAppInfo(context: InfoContext): Promise<AlertCustomSection[]> {
  const {app, remoteApp, organization, project} = context
  const account = await remoteApp.developerPlatformClient.accountInfo()
  return new AppInfo(app, remoteApp, organization, project, account).output()
}

export async function renderAppInfo(context: InfoContext): Promise<void> {
  renderInfo({customSections: await formatAppInfo(context)})
}

export function formatAppInfoResult(result: AppInfoResult, format: 'json' | 'text'): OutputMessage {
  if (format === 'json') return appInfoJsonOutputSchema.encode(result)
  if (!('name' in result)) {
    return outputContent`
    ${outputToken.green('SHOPIFY_API_KEY')}=${result.SHOPIFY_API_KEY}
    ${outputToken.green('SHOPIFY_API_SECRET')}=${result.SHOPIFY_API_SECRET ?? ''}
    ${outputToken.green('SCOPES')}=${result.SCOPES}
  `
  }
  throw new Error('App information text output requires the loaded app context.')
}

export function renderAppInfoResult(result: AppInfoResult, format: 'json' | 'text'): void {
  outputResult(formatAppInfoResult(result, format))
}

const UNKNOWN_TEXT = 'unknown'
const NOT_CONFIGURED_TOKEN: InlineToken = {subdued: 'Not yet configured'}
const NOT_LOADED_TEXT = 'NOT LOADED'

class AppInfo {
  private readonly app: AppLinkedInterface
  private readonly remoteApp: OrganizationApp
  private readonly organization: Organization
  private readonly project: Project
  private readonly account: AccountInfo

  constructor(
    app: AppLinkedInterface,
    remoteApp: OrganizationApp,
    organization: Organization,
    project: Project,
    account: AccountInfo,
  ) {
    this.app = app
    this.remoteApp = remoteApp
    this.organization = organization
    this.project = project
    this.account = account
  }

  async output(): Promise<AlertCustomSection[]> {
    return [
      ...(await this.devConfigsSection()),
      this.projectSettingsSection(),
      ...(await this.appComponentsSection()),
      await this.systemInfoSection(),
    ]
  }

  async devConfigsSection(): Promise<AlertCustomSection[]> {
    let updateUrls = NOT_CONFIGURED_TOKEN
    if (this.app.configuration.build?.automatically_update_urls_on_dev !== undefined) {
      updateUrls = this.app.configuration.build.automatically_update_urls_on_dev ? 'Yes' : 'No'
    }

    let userAccountInfo: [string, string] = ['User', 'unknown']
    const retrievedAccountInfo = this.account
    if (isServiceAccount(retrievedAccountInfo)) {
      userAccountInfo = ['Service account', retrievedAccountInfo.orgName]
    } else if (isUserAccount(retrievedAccountInfo)) {
      userAccountInfo[1] = retrievedAccountInfo.email
    }

    return [
      this.tableSection(
        'Current app configuration',
        [
          ['Configuration file', {filePath: basename(this.app.configPath) || configurationFileNames.app}],
          ['App name', this.remoteApp.title ? {userInput: this.remoteApp.title} : NOT_CONFIGURED_TOKEN],
          ['Client ID', this.remoteApp.apiKey || NOT_CONFIGURED_TOKEN],
          ['Organization', `${this.organization.businessName} (${this.organization.id})`],
          ['Access scopes', getAppScopes(this.app.configuration)],
          [
            'Dev store',
            this.app.configuration.build?.dev_store_url ?? this.app.hiddenConfig.dev_store_url ?? NOT_CONFIGURED_TOKEN,
          ],
          ['Update URLs', updateUrls],
          userAccountInfo,
        ],
        {isFirstItem: true},
      ),
      {
        body: [
          '💡 To change these, run',
          {command: formatPackageManagerCommand(this.project.packageManager, 'shopify app config link')},
        ],
      },
    ]
  }

  projectSettingsSection(): AlertCustomSection {
    return this.tableSection('Your Project', [['Root location', {filePath: this.app.directory}]])
  }

  async appComponentsSection(): Promise<AlertCustomSection[]> {
    const webComponentsSection = this.webComponentsSection()
    return [
      {
        title: '\nDirectory components'.toUpperCase(),
        body: '',
      },
      ...(webComponentsSection ? [webComponentsSection] : []),
      ...this.extensionsSections(),
    ]
  }

  webComponentsSection(): AlertCustomSection | undefined {
    const errors: string[] = []
    const sublevels: InlineToken[][] = []
    if (!this.app.webs[0]) return
    this.app.webs.forEach((web) => {
      if (web.configuration) {
        if (web.configuration.name) {
          const {name, roles} = web.configuration
          const pathToWeb = relativePath(this.app.directory, web.directory)
          sublevels.push([`    📂 ${name}`, {filePath: pathToWeb || '/'}])
          if (roles.length > 0) {
            sublevels.push(['         roles', roles.join(', ')])
          }
        } else {
          web.configuration.roles.forEach((role) => {
            sublevels.push([`    📂 ${role}`, {filePath: relativePath(this.app.directory, web.directory)}])
          })
        }
      } else {
        sublevels.push([{subdued: `  📂 ${UNKNOWN_TEXT}`}, {filePath: relativePath(this.app.directory, web.directory)}])
      }
      if (!this.app.errors.isEmpty()) {
        const fileErrors = this.app.errors.getErrors(`${web.directory}/${configurationFileNames.web}`)
        errors.push(...fileErrors.map((err) => err.message))
      }
    })

    return this.subtableSection('web', [
      ['📂 web', ''],
      ...sublevels,
      ...errors.map((error): InlineToken[] => [{error: 'error'}, {error: this.formattedError(error)}]),
    ])
  }

  extensionsSections(): AlertCustomSection[] {
    const extensions = this.app.allExtensions.filter((ext) => ext.isReturnedAsInfo())
    const types = uniq(extensions.map((ext) => ext.type))
    const sections = types.map((extensionType: string): AlertCustomSection | undefined => {
      const relevantExtensions = extensions.filter((extension: ExtensionInstance) => extension.type === extensionType)
      if (relevantExtensions[0]) {
        return this.subtableSection(
          relevantExtensions[0].externalType,
          relevantExtensions.flatMap((ext) => this.extensionSubSection(ext)),
        )
      }
    })
    return getArrayRejectingUndefined(sections)
  }

  extensionSubSection(extension: ExtensionInstance): InlineToken[][] {
    const config = extension.configuration
    const details: InlineToken[][] = [
      [`📂 ${extension.handle || NOT_LOADED_TEXT}`, {filePath: relativePath(this.app.directory, extension.directory)}],
      ['     config file', {filePath: relativePath(extension.directory, extension.configurationPath)}],
    ]
    if (config && 'metafields' in config && Array.isArray(config.metafields) && config.metafields.length > 0) {
      details.push(['     metafields', `${config.metafields.length}`])
    }
    const fileErrors = this.app.errors.getErrors(extension.configurationPath)
    for (const error of fileErrors) {
      details.push([{error: '     error'}, {error: this.formattedError(error.message)}])
    }

    return details
  }

  formattedError(str: string): string {
    const rawErrorMessage = str.trim()
    if (shouldDisplayColors()) return rawErrorMessage
    const [errorFirstLine, ...errorRemainingLines] = rawErrorMessage.split('\n')
    return [`! ${errorFirstLine}`, ...errorRemainingLines.map((line) => `  ${line}`)].join('\n')
  }

  async systemInfoSection(): Promise<AlertCustomSection> {
    const {platform, arch} = platformAndArch()
    return this.tableSection('Tooling and System', [
      ['Shopify CLI', CLI_KIT_VERSION],
      ['Package manager', this.project.packageManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL ?? 'unknown'],
      ['Node version', process.version],
    ])
  }

  tableSection(title: string, rows: InlineToken[][], {isFirstItem = false} = {}): AlertCustomSection {
    return {
      title: `${isFirstItem ? '' : '\n'}${title.toUpperCase()}\n`,
      body: {tabularData: rows, firstColumnSubdued: true},
    }
  }

  subtableSection(title: string, rows: InlineToken[][]): AlertCustomSection {
    return {
      title,
      body: {tabularData: rows, firstColumnSubdued: true},
    }
  }
}
