import {isSpin} from './spin.js'
import constants from '../constants.js'
import {Environment} from '../network/service.js'

export function serviceEnvironment(env = process.env): Environment {
  const value = env[constants.environmentVariables.serviceEnv]
  if (value === 'local') {
    return Environment.Local
  } else if (value === 'spin' || isSpin(env)) {
    return Environment.Spin
  } else {
    return Environment.Production
  }
}

export function isSpinEnvironment(env = process.env): boolean {
  return serviceEnvironment(env) === Environment.Spin
}
