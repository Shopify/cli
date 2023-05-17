import {schemaUrlV1} from './schemas/update_extension_schema_v1.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export async function init(rawPath?: string) {
  const path = joinPath(rawPath ?? '.', 'update_extension.json')

  await createScript(path)

  renderSuccess({
    body: [`The '${relativePath('.', path)}' script has been created.`],
  })
}

async function createScript(path: string) {
  try {
    if (await fileExists(path)) {
      const message = `The file ${path} already exists.`

      throw new AbortError(message)
    }

    await writeFile(path, initialScript())

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const message = `The '${relativePath('.', path)}' script couldn't be created.`
    const cause = `Cause: ${error.message}`

    throw new AbortError(message, cause)
  }
}

function initialScript() {
  return JSON.stringify(
    {
      $schema: schemaUrlV1,
      theme_name: '',
      theme_version: '',
      operations: [],
    },
    null,
    2,
  )
}
