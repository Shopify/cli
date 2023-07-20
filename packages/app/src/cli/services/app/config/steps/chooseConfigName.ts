/* eslint-disable @typescript-eslint/no-explicit-any */

import {selectConfigName} from '../../../../prompts/config.js'
import {createStep, transition} from '../utils/utils.js'
import {joinPath} from '@shopify/cli-kit/node/path'

export default createStep('chooseConfigName', chooseConfigName)

export async function chooseConfigName(options: any) {
  const configName = await selectConfigName(options.directory, options.remoteApp.title)
  const fullName = `shopify.app.${configName}.toml`
  const configFilePath = joinPath(options.directory, fullName)

  const nextOptions = {...options, configFilePath, configFileName: configName}

  await transition({step: 'writeFile', options: nextOptions})
}
