import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
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

  const file = await TomlFile.read(extension.configurationPath)
  const extensionsArray = getPathValue(file.content, 'extensions') as ExtensionInstance[]

  if ('uid' in file.content) return
  if (extensionsArray) {
    const currentExtension = extensionsArray.find((ext) => ext.handle === extension.handle)
    if (currentExtension && 'uid' in currentExtension) return
  }

  if (extensionsArray && extensionsArray.length > 1) {
    // Multi-extension TOML: use regex to insert uid after the correct handle.
    // updateTomlValues (WASM) doesn't support patching individual array-of-tables entries,
    // so transformRaw with positional insertion is the pragmatic choice here.
    const handle = extension.handle
    await file.transformRaw((raw) => {
      const regex = new RegExp(`(\\n?(\\s*)handle\\s*=\\s*"${handle}")`)
      return raw.replace(regex, `$1\n$2uid = "${extension.uid}"`)
    })
  } else {
    // Single extension (or no extensions array): add uid at the top level via WASM patch
    await file.patch({uid: extension.uid})
  }
}
