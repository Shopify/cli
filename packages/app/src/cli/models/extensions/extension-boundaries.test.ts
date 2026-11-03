import {ExtensionInstance, ExtensionInstanceRuntime, isUIExtensionInstance} from './extension-instance.js'
import {BaseSchema, CommonExtensionSchema} from './schemas.js'
import {createExtensionSpecification, ExtensionSpecification, ExtensionSpecificationRuntime} from './specification.js'
import {describe, expect, expectTypeOf, test, vi} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const TableCapabilitiesSchema = CommonExtensionSchema.extend({
  type: zod.literal('table_capabilities'),
  capabilities: zod.object({network_access: zod.object({allowed_sources: zod.array(zod.string())})}),
})
const BooleanCapabilitiesSchema = BaseSchema.extend({type: zod.literal('boolean_capabilities')})
type TableConfiguration = zod.infer<typeof TableCapabilitiesSchema>
type BooleanConfiguration = zod.infer<typeof BooleanCapabilitiesSchema>

function tableSpecification(preview = false) {
  return createExtensionSpecification({
    identifier: 'table_capabilities',
    schema: TableCapabilitiesSchema,
    appModuleFeatures: () => (preview ? ['ui_preview'] : []),
    deployConfig: async (configuration) => ({sources: configuration.capabilities.network_access.allowed_sources}),
  })
}

function booleanSpecification() {
  return createExtensionSpecification({
    identifier: 'boolean_capabilities',
    schema: BooleanCapabilitiesSchema,
    appModuleFeatures: () => ['ui_preview'],
    deployConfig: async (configuration) => ({networkAccess: configuration.capabilities?.network_access ?? false}),
  })
}

const instanceOptions = {configurationPath: '/app/shopify.extension.toml', directory: '/app/extensions/example'}

describe('extension configuration boundaries', () => {
  test('keeps configuration-specific capabilities out of the common schema', () => {
    expect(CommonExtensionSchema.shape).not.toHaveProperty('capabilities')
    expect(BaseSchema.safeParse({capabilities: {network_access: true}}).success).toBe(true)
    expect(BaseSchema.safeParse({capabilities: {network_access: {allowed_sources: []}}}).success).toBe(false)
  })

  test('preserves configuration and specification types together', () => {
    type Options = ConstructorParameters<typeof ExtensionInstance<TableConfiguration>>[0]
    type MismatchedOptions = Omit<Options, 'configuration'> & {configuration: BooleanConfiguration}
    type FactoryOptions = Parameters<typeof createExtensionSpecification<TableConfiguration>>[0]
    expectTypeOf<Options['specification']>().toEqualTypeOf<ExtensionSpecification<TableConfiguration>>()
    expectTypeOf<MismatchedOptions>().not.toExtend<Options>()
    expectTypeOf<ExtensionSpecification<BooleanConfiguration>>().not.toExtend<
      ExtensionSpecification<TableConfiguration>
    >()
    expectTypeOf<'deployConfig' extends keyof ExtensionSpecificationRuntime ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<'validate' extends keyof ExtensionSpecificationRuntime ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<{} extends Pick<FactoryOptions, 'schema'> ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<ExtensionInstanceRuntime>().not.toExtend<ExtensionInstanceRuntime<zod.infer<typeof BaseSchema>>>()
    type RuntimeParsedConfiguration = Extract<
      ReturnType<ExtensionSpecificationRuntime['parseConfigurationObject']>,
      {state: 'ok'}
    >['data']
    expectTypeOf<RuntimeParsedConfiguration['capabilities']>().toEqualTypeOf<unknown>()
  })

  test('preserves legacy field order when configurations are serialized', () => {
    const configuration = BaseSchema.parse({
      settings: {fields: []},
      supported_features: {runs_offline: true},
      capabilities: {network_access: true},
      extension_points: [],
      api_version: '2026-10',
      description: 'test',
      uid: 'test-uid',
      handle: 'test-handle',
      type: 'test',
      name: 'Test extension',
    })
    expect(Object.keys(configuration)).toEqual([
      'name',
      'type',
      'handle',
      'uid',
      'description',
      'api_version',
      'extension_points',
      'capabilities',
      'supported_features',
      'settings',
    ])
  })

  test('constructs mixed configurations and invokes their own bound callbacks', async () => {
    const specifications: ExtensionSpecificationRuntime[] = [tableSpecification(), booleanSpecification()]
    const inputs = [
      {type: 'table_capabilities', capabilities: {network_access: {allowed_sources: ['https://example.com']}}},
      {type: 'boolean_capabilities', capabilities: {network_access: true}},
    ]
    const instances: ExtensionInstanceRuntime[] = await Promise.all(
      specifications.map(async (specification, index) => {
        const parsed = await specification.createInstance({...instanceOptions, configurationObject: inputs[index]!})
        expect(parsed.state).toBe('ok')
        if (parsed.state === 'error') throw new Error(JSON.stringify(parsed.errors))
        return parsed.data
      }),
    )
    const results = await Promise.all(
      instances.map((instance) => instance.deployConfig({apiKey: '', appConfiguration: {client_id: ''}})),
    )
    expect(results).toEqual([{sources: ['https://example.com']}, {networkAccess: true}])
    const uiInstances = instances.filter(isUIExtensionInstance)
    expect(uiInstances).toHaveLength(1)
    expect(uiInstances[0]!.configuration.capabilities?.network_access).toBe(true)
  })

  test('uses the final parser and metadata after specifications are merged', async () => {
    const original = tableSpecification()
    const parser = vi.fn(original.parseConfigurationObject)
    const merged = {...original, externalIdentifier: 'remote_table', parseConfigurationObject: parser}
    const resolveEntryPath = vi.fn().mockResolvedValue('/app/extensions/example/index.js')
    const result = await merged.createInstance({
      ...instanceOptions,
      configurationObject: {type: 'table_capabilities', capabilities: {network_access: {allowed_sources: []}}},
      resolveEntryPath,
    })
    expect(result.state).toBe('ok')
    expect(parser).toHaveBeenCalledTimes(1)
    expect(resolveEntryPath).toHaveBeenCalledTimes(1)
    if (result.state === 'ok') {
      expect(result.data.specification).toBe(merged)
      expect(result.data.externalType).toBe('remote_table')
      expect(result.data.entrySourceFilePath).toBe('/app/extensions/example/index.js')
      expectTypeOf(result.data.configuration).toEqualTypeOf<TableConfiguration>()
    }
  })

  test('rejects invalid configurations before resolving an entry path', async () => {
    const resolveEntryPath = vi.fn().mockResolvedValue('/unused.js')
    const result = await tableSpecification().createInstance({
      ...instanceOptions,
      configurationObject: {type: 'table_capabilities', capabilities: {network_access: true}},
      resolveEntryPath,
    })
    expect(result.state).toBe('error')
    expect(resolveEntryPath).not.toHaveBeenCalled()
  })

  test('does not expose table capabilities to UI consumers even when preview is enabled', async () => {
    const result = await tableSpecification(true).createInstance({
      ...instanceOptions,
      configurationObject: {type: 'table_capabilities', capabilities: {network_access: {allowed_sources: []}}},
    })
    expect(result.state).toBe('ok')
    if (result.state === 'ok') expect(isUIExtensionInstance(result.data)).toBe(false)
  })

  test('does not revalidate unrelated fields when narrowing UI capabilities', async () => {
    const specification = createExtensionSpecification({
      identifier: 'legacy_ui',
      schema: BaseSchema.extend({settings: zod.any()}),
      appModuleFeatures: () => ['ui_preview'],
    })
    const result = await specification.createInstance({
      ...instanceOptions,
      configurationObject: {settings: {fields: {custom: true}}, capabilities: {network_access: true}},
    })
    expect(result.state).toBe('ok')
    if (result.state === 'ok') expect(isUIExtensionInstance(result.data)).toBe(true)
  })

  test('expands configurations within their specification and preserves consumed keys', () => {
    const expandConfig = vi.fn((configuration: {entries?: string[]}) => configuration.entries!.map((name) => ({name})))
    const specification = createExtensionSpecification({
      identifier: 'expanding',
      schema: CommonExtensionSchema.extend({entries: zod.array(zod.string()).optional()}),
      appModuleFeatures: () => [],
      expandConfig,
    })
    expect(specification.expandConfiguration({entries: ['first', 'second'], unrelated: true}, {flags: []})).toEqual({
      state: 'ok',
      data: {configurations: [{name: 'first'}, {name: 'second'}], consumedKeys: ['entries']},
      errors: undefined,
    })
    expandConfig.mockClear()
    expect(specification.expandConfiguration({}, {flags: []})).toEqual({
      state: 'ok',
      data: {configurations: [], consumedKeys: []},
      errors: undefined,
    })
    expect(expandConfig).not.toHaveBeenCalled()
  })
})
