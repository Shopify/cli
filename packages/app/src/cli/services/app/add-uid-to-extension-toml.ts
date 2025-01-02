import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'

export async function addUidToTomlsIfNecessary(
  extensions: ExtensionInstance[],
  developerPlatformClient: DeveloperPlatformClient,
) {
  if (!developerPlatformClient.supportsAtomicDeployments) return

  // We can't update the TOML files in parallel because some extensions might share the same file
  for (const extension of extensions) {
    // eslint-disable-next-line no-await-in-loop
    await addUidToToml(extension)
  }
}

async function addUidToToml(extension: ExtensionInstance) {
  if (!extension.isUUIDStrategyExtension || extension.configuration.uid) return

  const tomlContents = await readFile(extension.configurationPath)
  const extensionConfig = decodeToml(tomlContents)
  const extensions = getPathValue(extensionConfig, 'extensions') as ExtensionInstance[]

  if ('uid' in extensionConfig) return
  if (extensions) {
    const currentExtension = extensions.find((ext) => ext.handle === extension.handle)
    if (currentExtension && 'uid' in currentExtension) return
  }

  let updatedTomlContents = tomlContents
  if (extensions?.length > 1) {
    // If the TOML has multiple extensions, we look for the correct handle to add the uid below
    const regex = new RegExp(`(\\n?(\\s*)handle\\s*=\\s*"${extension.handle}")`)
    updatedTomlContents = tomlContents.replace(regex, `$1\n$2uid = "${extension.uid}"`)
  } else {
    // If the TOML has only one extension, we add the uid before the type, which is always present
    if ('uid' in extensionConfig) return
    const regex = /\n?((\s*)type\s*=\s*"\S*")/
    updatedTomlContents = tomlContents.replace(regex, `$2\nuid = "${extension.uid}"\n$1`)
  }
  await writeFile(extension.configurationPath, updatedTomlContents)
}
