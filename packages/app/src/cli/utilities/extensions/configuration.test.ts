import {LocalAppConfiguration} from './configuration.js'
import {AppConfiguration} from '../../models/app/app.js'
import {expect, describe, beforeEach, test} from 'vitest'

describe('LocalAppConfiguration', () => {
  let configInstance: LocalAppConfiguration

  beforeEach(() => {
    configInstance = LocalAppConfiguration.getInstance()
    configInstance.initializeConfig(getConfig({}))
  })

  test('should return the same instance', () => {
    const instance1 = LocalAppConfiguration.getInstance()
    const instance2 = LocalAppConfiguration.getInstance()
    expect(instance1).toBe(instance2)
  })

  test('should initialize config correctly', () => {
    const initialConfig = getConfig({application_url: 'https://example.com'})
    configInstance.initializeConfig(initialConfig)
    expect(configInstance.getFullConfig()).toEqual(initialConfig)
  })

  test('config can be overwritten', () => {
    const initialConfig = getConfig({application_url: 'https://example.com'})
    configInstance.initializeConfig(initialConfig)
    expect(configInstance.getFullConfig()).toEqual(initialConfig)
    const newConfig = getConfig({application_url: 'https://example2.com'})
    configInstance.initializeConfig(newConfig)
    expect(configInstance.getFullConfig()).toEqual(newConfig)
  })

  test('should return the full config', () => {
    const initialConfig = getConfig({application_url: 'https://example.com'})
    configInstance.initializeConfig(initialConfig)
    expect(configInstance.getFullConfig()).toEqual(initialConfig)
  })

  test('should return the correct config value for a given path', () => {
    const initialConfig = getConfig({webhooks: {subscriptions: [{uri: 'https://example.com'}]}})
    configInstance.initializeConfig(initialConfig)
    expect(configInstance.getConfigValue('webhooks.subscriptions[0].uri')).toBe('https://example.com')
  })
})

const getConfig = (config: object) => {
  return config as AppConfiguration
}
