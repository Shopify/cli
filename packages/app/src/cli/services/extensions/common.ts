import {AppInterface} from '../../models/app/app.js'
import {blocks} from '../../constants.js'
import {ExtensionFlavor} from '../../models/app/template.js'
import {OrganizationApp} from '../../models/organization.js'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, findPathUp, mkdir} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {hyphenate} from '@shopify/cli-kit/common/string'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {fileURLToPath} from 'url'

export async function ensureDownloadedExtensionFlavorExists(
  extensionFlavor: ExtensionFlavor | undefined,
  templateDownloadDir: string,
): Promise<string> {
  const templatePath = extensionFlavor?.path || ''
  const origin = joinPath(templateDownloadDir, templatePath)
  if (!(await fileExists(origin))) {
    throw new AbortError(`\nThe extension is not available for ${extensionFlavor?.value}`)
  }
  return origin
}

export async function ensureLocalExtensionFlavorExists(extensionFlavor: ExtensionFlavor | undefined): Promise<string> {
  const templatePath = extensionFlavor?.path || ''

  const templateDirectory = await findPathUp(templatePath, {
    cwd: dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
  })

  if (!templateDirectory) {
    throw new AbortError(`\nThe extension is not available for ${extensionFlavor?.value}`)
  }

  return templateDirectory
}

export async function ensureExtensionDirectoryExists({name, app}: {name: string; app: AppInterface}): Promise<string> {
  const hyphenizedName = hyphenate(name)
  const extensionDirectory = joinPath(app.directory, blocks.extensions.directoryName, hyphenizedName)
  if (await fileExists(extensionDirectory)) {
    throw new AbortError(
      `\nA directory with this name (${hyphenizedName}) already exists.\nChoose a new name for your extension.`,
    )
  }
  await mkdir(extensionDirectory)
  return extensionDirectory
}

export async function renderDevPreviewWarning(
  remoteApp: Partial<OrganizationApp>,
  localApp: AppInterface,
): Promise<void> {
  const body = await buildDevPreviewWarning(remoteApp, localApp)
  if (!body) return

  outputInfo(`\n${body}\n`)
}

export async function buildDevPreviewWarning(remoteApp: Partial<OrganizationApp>, localApp: AppInterface) {
  const unifiedDeployment = remoteApp?.betas?.unifiedAppDeployment ?? false
  if (!unifiedDeployment) return

  const draftableExtensions = localApp.allExtensions.filter((ext) => ext.isDraftable(unifiedDeployment))
  const themeExtensions = localApp.allExtensions.filter((ext) => ext.isThemeExtension)
  if (draftableExtensions.length === 0 && themeExtensions.length === 0) return

  const link = outputToken.link(
    'Partner Dashboard',
    `https://${await partnersFqdn()}/${remoteApp.organizationId}/apps/${remoteApp.id}/extensions`,
  )
  return outputContent`To preview your extensions, make sure that development store preview is enabled in the ${link}.`
    .value
}
