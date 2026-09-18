import {AppLogSourcesResult} from './sources/types.js'
import {AppInterface} from '../../models/app/app.js'

export function sources(app: AppInterface): AppLogSourcesResult {
  return app.allExtensions
    .filter((extension) => extension.isFunctionExtension)
    .map((extension) => ({
      source: `extensions.${extension.configuration.handle}`,
      namespace: 'extensions',
      handle: extension.handle,
      name: extension.name,
      type: extension.type,
      externalType: extension.externalType,
      humanName: extension.humanName,
      uid: extension.uid,
      directory: extension.directory,
      configurationPath: extension.configurationPath,
      configuration: extension.configuration,
      entrySourceFilePath: extension.entrySourceFilePath,
      outputPath: extension.outputPath,
      surface: extension.surface,
      features: extension.features,
      dependency: extension.dependency,
    }))
}
