import {isSpin} from './spin.js'
import constants from '../constants.js'
import {Environment} from '../network/service.js'
import {getEnvironmentVariables} from '../public/node/environment.js'

export function serviceEnvironment(): Environment {
  const value = getEnvironmentVariables()[constants.environmentVariables.serviceEnv]
  if (value === 'local') {
    return Environment.Local
  } else if (value === 'spin' || isSpin()) {
    return Environment.Spin
  } else {
    return Environment.Production
  }
}

export function isSpinEnvironment(): boolean {
  return serviceEnvironment() === Environment.Spin
}
