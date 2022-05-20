import {updateAppConfigurationFile} from './update'
import {blocks, configurationFileNames} from '../../constants'
import {load} from '../../models/app/app'
import {describe, it, expect} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'

const appConfiguration = `
name = "my_app"
scopes = "read_products"
`
const webConfiguration = `
type = "backend"

[commands]
build = "./build.sh"
dev = "./dev.sh"
`

const writeConfig = async (appConfiguration: string, tmpDir: string) => {
  const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
  const webConfigurationPath = path.join(tmpDir, blocks.web.directoryName, blocks.web.configurationName)

  await file.mkdir(path.dirname(webConfigurationPath))
  await file.write(path.join(tmpDir, 'package.json'), JSON.stringify({dependencies: {}, devDependencies: {}}))
  await file.write(appConfigurationPath, appConfiguration)
  await file.write(webConfigurationPath, webConfiguration)
}

describe('updateAppConfigurationFile', () => {
  it('Merges the new data, with existing data', async () => {
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
      expect(updatedApp.configuration.scopes).toEqual('read_products')
    })
  })
})
