// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {file, output, path} from '@shopify/cli-kit'

import {App, load as loadApp} from '../../app/app'
import {configurationFileNames, ExtensionTypes} from '../../constants'

import extensionInit from './extension'

describe('initialize an extension', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await file.mkTmpDir()
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
    const appConfiguration = `
      name = "my_app"
      `
    await file.write(appConfigurationPath, appConfiguration)
  })
  afterEach(async () => {
    vi.clearAllMocks()
    if (tmpDir) {
      await file.rmdir(tmpDir)
    }
  })

  interface CreateFromTemplateOptions {
    name: string
    extensionType: ExtensionTypes
  }
  const createFromTemplate = async ({
    name,
    extensionType,
  }: CreateFromTemplateOptions) => {
    await extensionInit({
      name,
      extensionType,
      parentApp: await loadApp(tmpDir),
    })
  }

  it('successfully scaffolds the extension when no other extensions exist', async () => {
    vi.spyOn(output, 'message').mockImplementation(() => {})
    const name = 'my-ext-1'
    const extensionType = 'checkout-post-purchase'
    await createFromTemplate({name, extensionType})
    expect(output.message).toBeCalledWith(
      output.content`Generating ${configurationFileNames.uiExtension}`,
    )
    expect(output.message).toBeCalledWith(output.content`Generating index.jsx`)
    const scaffoldedExtension = (await loadApp(tmpDir)).uiExtensions[0]
    expect(scaffoldedExtension.configuration.name).toBe(name)
  })

  it('successfully scaffolds the extension when another extension exists', async () => {
    const name1 = 'my-ext-1'
    const name2 = 'my-ext-2'
    const extensionType = 'checkout-post-purchase'
    await createFromTemplate({name: name1, extensionType})
    await createFromTemplate({name: name2, extensionType})
    const scaffoldedExtension2 = (await loadApp(tmpDir)).uiExtensions[1]
    expect(scaffoldedExtension2.configuration.name).toBe(name2)
  })

  it('errors when trying to re-scaffold an existing extension', async () => {
    const name = 'my-ext-1'
    const extensionType = 'checkout-post-purchase'
    await createFromTemplate({name, extensionType})
    await expect(createFromTemplate({name, extensionType})).rejects.toThrow(
      `Extension ${name} already exists!`,
    )
  })
})
