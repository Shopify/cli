import {strictEventsContract} from './events-strict-schema.test-data.js'
import {fetchSpecifications} from '../generate/fetch-extension-specifications.js'
import {DEFAULT_CONFIG, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
import {expect, test} from 'vitest'

const subscription = {handle: 'Exact_CASE', topic: 'products', actions: ['update'], uri: '/events'}

async function fetchedEventsSpecification() {
  const specifications = await fetchSpecifications({
    app: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient({
      specifications: async () => [
        {
          identifier: 'events',
          externalIdentifier: 'events',
          externalName: 'Events',
          name: 'Events',
          experience: 'configuration',
          managementExperience: 'cli',
          gated: false,
          registrationLimit: 1000,
          uidStrategy: 'single',
          validationSchema: {jsonSchema: JSON.stringify(strictEventsContract)},
        },
      ],
    }),
  })
  const specification = specifications.find((spec) => spec.identifier === 'events')
  if (!specification) throw new Error('Missing Events specification')
  return specification
}

test.each([false, true])(
  'fetched parser preserves editing identity through repeat validation and wire output, list=%s',
  async (list) => {
    const specification = await fetchedEventsSpecification()
    const input = {events: {api_version: '2026-07', subscription: list ? [subscription] : subscription}}
    const before = structuredClone(input)
    const parsed = specification.parseConfigurationObject(input)
    expect(parsed.state).toBe('ok')
    if (parsed.state !== 'ok') throw new Error('Expected valid Events config')
    expect(specification.parseConfigurationObject(parsed.data)).toEqual(parsed)
    expect(input).toEqual(before)
    const extension = new ExtensionInstance({
      configuration: parsed.data,
      configurationPath: '/unused/shopify.app.toml',
      directory: '/unused',
      specification,
    })
    expect(extension.handle).toBe(list ? 'events' : 'Exact_CASE')
    expect(extension.uid).toBe(list ? 'events' : 'Exact_CASE')
    const wire = await extension.deployConfig({apiKey: 'test-key', appConfiguration: DEFAULT_CONFIG})
    expect(wire).not.toHaveProperty('handle')
    expect(wire).not.toHaveProperty('events.subscription.handle')
    expect(wire).toHaveProperty(
      list ? 'events.subscription.0.handle' : 'events.subscription.topic',
      list ? 'Exact_CASE' : 'products',
    )
    expect(jsonSchemaValidate(wire ?? {}, strictEventsContract, 'fail').state).toBe('ok')
  },
)

test.each([{unexpected: true}, {topic: 'not-a-topic'}, {actions: []}, {uri: 123}])(
  'fetched parser still rejects invalid object fields: %j',
  async (invalid) => {
    const specification = await fetchedEventsSpecification()
    const parsed = specification.parseConfigurationObject({
      events: {
        api_version: '2026-07',
        subscription: {...subscription, ...invalid},
      },
    })
    expect(parsed.state).toBe('error')
  },
)

test('normalization does not weaken validation on repeated parsing', async () => {
  const specification = await fetchedEventsSpecification()
  const parsed = specification.parseConfigurationObject({events: {api_version: '2026-07', subscription}})
  if (parsed.state !== 'ok') throw new Error('Expected valid Events config')
  const invalid = specification.parseConfigurationObject({
    ...parsed.data,
    events: {
      api_version: '2026-07',
      subscription: {topic: 'products', actions: ['update'], uri: '/events', unexpected: true},
    },
  })
  expect(invalid.state).toBe('error')
})
