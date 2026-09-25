import {configurationFromModules, ConfigurationModuleEntry} from './configuration-modules.js'
import {
  createConfigExtensionSpecification,
  createExtensionSpecification,
} from '../../models/extensions/specification.js'
import {BaseSchema} from '../../models/extensions/schemas.js'
import eventsSpec from '../../models/extensions/specifications/app_config_events.js'
import {Flag} from '../../utilities/developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'

const FLAGS = [Flag.SingleSubscriptionEventsModules]

describe('configurationFromModules', () => {
  test('collects interleaved opt-in modules once while retaining scalar order and section ownership', () => {
    const calls: string[] = []
    const aggregateOne = vi.fn((modules) => {
      calls.push('one')
      return {one: modules.map((module: {handle: string}) => module.handle)}
    })
    const aggregateTwo = vi.fn((modules) => {
      calls.push('two')
      return {two: modules.map((module: {handle: string}) => module.handle)}
    })
    const one = createExtensionSpecification({
      identifier: 'one',
      appModuleFeatures: () => [],
      aggregateModuleConfigurations: aggregateOne,
    })
    const two = createExtensionSpecification({
      identifier: 'two',
      appModuleFeatures: () => [],
      aggregateModuleConfigurations: aggregateTwo,
    })
    const scalar = createExtensionSpecification({identifier: 'scalar', appModuleFeatures: () => []})
    const entries = [
      {specification: scalar, module: {handle: 's1', config: {shared: {value: 'first', list: ['a']}}}},
      {specification: one, module: {handle: 'a', config: {}}},
      {specification: two, module: {handle: 'x', config: {}}},
      {specification: scalar, module: {handle: 's2', config: {shared: {value: 'second', list: ['b']}}}},
      {specification: one, module: {handle: 'b', config: {}}},
      {specification: two, module: {handle: 'y', config: {}}},
      {specification: scalar, module: {handle: 's3', config: {shared: {value: 'last', list: ['c']}}}},
    ]
    const result = configurationFromModules(entries, FLAGS, ({module}) => {
      calls.push(module.handle)
      return module.config
    })
    expect(result).toEqual({shared: {value: 'last', list: ['a', 'b', 'c']}, one: ['a', 'b'], two: ['x', 'y']})
    expect(calls).toEqual(['s1', 'one', 'two', 's2', 's3'])
    expect(aggregateOne).toHaveBeenCalledExactlyOnceWith([entries[1]?.module, entries[4]?.module], {flags: FLAGS})
    expect(aggregateTwo).toHaveBeenCalledExactlyOnceWith([entries[2]?.module, entries[5]?.module], {flags: FLAGS})
    expect(entries[0]?.module.config).toEqual({shared: {value: 'first', list: ['a']}})
  })

  test('non-opt-in union still uses Set/reference identity, not structural deduplication', () => {
    const specification = createExtensionSpecification({identifier: 'scalar', appModuleFeatures: () => []})
    const sameReference = {id: 1}
    const equalValue = {id: 1}
    const entries = [
      {specification, module: {handle: 'one', config: {list: [sameReference, 'a']}}},
      {specification, module: {handle: 'two', config: {list: [sameReference, equalValue, 'a', 'b']}}},
    ]
    const result = configurationFromModules(entries, [], ({module}) => module.config)
    expect(result).toEqual({list: [sameReference, 'a', equalValue, 'b']})
  })

  test('keeps caller-specific fallbacks when a scalar transform is absent', () => {
    const specification = createExtensionSpecification({identifier: 'scalar', appModuleFeatures: () => []})
    const entry = {specification, module: {handle: 'A', config: {remote: true}}, local: {local: true}}
    expect(configurationFromModules([entry], [], ({module}) => module.config)).toEqual({remote: true})
    expect(configurationFromModules([entry], [], ({local}) => local)).toEqual({local: true})
    expect(configurationFromModules<ConfigurationModuleEntry>([], [], () => ({unused: true}))).toEqual({})
  })

  test('factory does not synthesize a weaker scalar readback for aggregation specifications', () => {
    const aggregateModuleConfigurations = vi.fn(() => ({owned: true}))
    const specification = createConfigExtensionSpecification({
      identifier: 'synthetic',
      schema: BaseSchema,
      transformConfig: {forward: (config) => config},
      aggregateModuleConfigurations,
    })
    expect(specification.transformRemoteToLocal).toBeUndefined()
    expect(eventsSpec.transformRemoteToLocal).toBeUndefined()
    expect(specification.aggregateModuleConfigurations).toBe(aggregateModuleConfigurations)
  })
})
