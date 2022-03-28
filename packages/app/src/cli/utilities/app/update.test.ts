import {updateAppConfigurationFile} from './update'
import {describe, it, expect} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'
import {configurationFileNames} from '$cli/constants'
import {load} from '$cli/models/app/app'

const appConfiguration = `
name = "my_app"
`

const writeConfig = async (appConfiguration: string, tmpDir: string) => {
  const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
  await file.write(appConfigurationPath, appConfiguration)
}

const mkdirHome = async (tmpDir: string) => {
  await file.mkdir(path.join(tmpDir, 'home'))
}

describe('updateAppConfigurationFile', () => {
  it('updates the app configuration file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await writeConfig(appConfiguration, tmpDir)
      await mkdirHome(tmpDir)
      const app = await load(tmpDir)

      // When
      await updateAppConfigurationFile(app, {name: 'new-name', id: 'new-id'})

      // Then
      const updatedApp = await load(tmpDir)
      expect(updatedApp.configuration.id).toEqual('new-id')
      expect(updatedApp.configuration.name).toEqual('new-name')
    })
  })
})
