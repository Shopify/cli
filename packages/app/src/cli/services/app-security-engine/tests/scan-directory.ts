import {scanApp} from '../run.js'
import {scan} from '../scanners/index.js'
import {getAppConfigurationFileName} from '../../../models/app/config-file-naming.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {ScanInput, ScanOptions} from '../types.js'

/** Resolves a test app the way the CLI would: the named configuration file in the directory is the selected TOML. */
function scanInputFor(appDirectory: string, configName?: string): ScanInput {
  return {appDirectory, appConfigFilePath: joinPath(appDirectory, getAppConfigurationFileName(configName))}
}

export function scanDirectory(appDirectory: string, configName?: string, options?: ScanOptions) {
  return scan(scanInputFor(appDirectory, configName), options)
}

export function scanAppDirectory(appDirectory: string, configName?: string, options?: ScanOptions) {
  return scanApp(scanInputFor(appDirectory, configName), options)
}
