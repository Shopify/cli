import {updateAppConfigurationFile} from './update'
import {describe, it, expect} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'
import {blocks, configurationFileNames} from '$cli/constants'
import {load} from '$cli/models/app/app'

const appConfiguration = `
name = "my_app"
`
const homeConfiguration = `
[commands]
build = "./build.sh"
dev = "./dev.sh"
`

const writeConfig = async (appConfiguration: string, tmpDir: string) => {
  const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
  const homeConfigurationPath = path.join(tmpDir, blocks.home.directoryName, blocks.home.configurationName)

  await file.mkdir(path.dirname(homeConfigurationPath))
  await file.write(appConfigurationPath, appConfiguration)
  await file.write(homeConfigurationPath, homeConfiguration)
}

describe('updateAppConfigurationFile', () => {
  it('updates the app configuration file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await writeConfig(appConfiguration, tmpDir)

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
