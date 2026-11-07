import {appGenerateExtensionJsonOutputSchema, type GenerateExtensionResult} from './types.js'
import {ExtensionTemplate} from '../../../models/app/template.js'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {formatPackageManagerCommand, outputResult} from '@shopify/cli-kit/node/output'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderGenerateExtensionResult(result: GenerateExtensionResult, json = false): void {
  const {extension, packageManager} = result
  if (json) {
    outputResult(
      appGenerateExtensionJsonOutputSchema.encode({
        status: result.status,
        extension: {
          name: extension.name,
          type: extension.extensionTemplate.type,
          template: extension.extensionTemplate.identifier,
          flavor: extension.flavor ?? null,
          directory: resolvePath(cwd(), extension.directory),
        },
      }),
    )
    return
  }

  renderSuccess(formatSuccessfulRunMessage(extension.extensionTemplate, extension.directory, packageManager))
}

function formatSuccessfulRunMessage(
  extensionTemplate: ExtensionTemplate,
  extensionDirectory: string,
  dependencyManager: PackageManager,
): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your extension was created in', {filePath: extensionDirectory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  if (extensionTemplate.type !== 'function') {
    options.nextSteps!.push([
      'To preview this extension along with the rest of the project, run',
      {command: formatPackageManagerCommand(dependencyManager, 'shopify app dev')},
    ])
  }

  if (extensionTemplate.supportLinks[0]) {
    options.reference!.push([
      'For more details, see the',
      {link: {label: 'docs', url: extensionTemplate.supportLinks[0]}},
    ])
  }

  return options
}
