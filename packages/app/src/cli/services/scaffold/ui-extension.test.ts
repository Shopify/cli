// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {file, output, path} from '@shopify/cli-kit'

import {App, load as loadApp} from '../../app/app'
import {configurationFileNames, UiExtensionTypes} from '../../constants'

import uiExtensionInit from './ui-extension'

describe('initialize a UI extension', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await file.mkTmpDir()
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
    const appConfiguration = `
      name = "my_app"
      `
    await file.write(appConfigurationPath, appConfiguration)
    await file.mkdir(path.join(tmpDir, 'home'))
  })
  afterEach(async () => {
    vi.clearAllMocks()
    if (tmpDir) {
      await file.rmdir(tmpDir)
    }
  })

  interface CreateFromTemplateOptions {
    name: string
    uiExtensionType: UiExtensionTypes
  }
  const createFromTemplate = async ({name, uiExtensionType}: CreateFromTemplateOptions) => {
    await uiExtensionInit({
      name,
      uiExtensionType,
      parentApp: await loadApp(tmpDir),
    })
  }

  it('successfully scaffolds the UI extension when no other UI extensions exist', async () => {
    vi.spyOn(output, 'message').mockImplementation(() => {})
    const name = 'my-ext-1'
    const uiExtensionType = 'checkout-post-purchase'
    await createFromTemplate({name, uiExtensionType})
    expect(output.message).toBeCalledWith(output.content`Generating ${configurationFileNames.uiExtension}`)
    expect(output.message).toBeCalledWith(output.content`Generating index.jsx`)
    const scaffoldedUiExtension = (await loadApp(tmpDir)).uiExtensions[0]
    expect(scaffoldedUiExtension.configuration.name).toBe(name)
  })

  it('successfully scaffolds the UI extension when another UI extension exists', async () => {
    const name1 = 'my-ext-1'
    const name2 = 'my-ext-2'
    const uiExtensionType = 'checkout-post-purchase'
    await createFromTemplate({name: name1, uiExtensionType})
    await createFromTemplate({name: name2, uiExtensionType})
    const scaffoldedUiExtension2 = (await loadApp(tmpDir)).uiExtensions[1]
    expect(scaffoldedUiExtension2.configuration.name).toBe(name2)
  })

  it('errors when trying to re-scaffold an existing UI extension', async () => {
    const name = 'my-ext-1'
    const uiExtensionType = 'checkout-post-purchase'
    await createFromTemplate({name, uiExtensionType})
    await expect(createFromTemplate({name, uiExtensionType})).rejects.toThrow(`UI Extension ${name} already exists!`)
  })
})
