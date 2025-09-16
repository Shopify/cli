import {getMigrationChoices, selectMigrationChoice, allMigrationChoices, MigrationChoice} from './import-extensions.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test, vi} from 'vitest'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/ui')

describe('allMigrationChoices', () => {
  test('contains all expected migration choices', () => {
    expect(allMigrationChoices).toHaveLength(5)

    const values = allMigrationChoices.map((choice) => choice.value)
    expect(values).toContain('payments')
    expect(values).toContain('flow')
    expect(values).toContain('marketing activity')
    expect(values).toContain('subscription link')
    expect(values).toContain('link extension')
  })

  test('each migration choice has required properties', () => {
    allMigrationChoices.forEach((choice) => {
      expect(choice).toHaveProperty('label')
      expect(choice).toHaveProperty('value')
      expect(choice).toHaveProperty('extensionTypes')
      expect(choice).toHaveProperty('buildTomlObject')
      expect(Array.isArray(choice.extensionTypes)).toBe(true)
      expect(choice.extensionTypes.length).toBeGreaterThan(0)
      expect(typeof choice.buildTomlObject).toBe('function')
    })
  })

  test('payments migration choice has correct extension types', () => {
    const paymentsChoice = allMigrationChoices.find((choice) => choice.value === 'payments')
    expect(paymentsChoice?.extensionTypes).toEqual([
      'payments_app',
      'payments_app_credit_card',
      'payments_app_custom_credit_card',
      'payments_app_custom_onsite',
      'payments_app_redeemable',
      'payments_extension',
    ])
  })

  test('flow migration choice has correct extension types', () => {
    const flowChoice = allMigrationChoices.find((choice) => choice.value === 'flow')
    expect(flowChoice?.extensionTypes).toEqual([
      'flow_action_definition',
      'flow_trigger_definition',
      'flow_trigger_discovery_webhook',
    ])
  })

  test('marketing activity migration choice has correct extension types', () => {
    const marketingChoice = allMigrationChoices.find((choice) => choice.value === 'marketing activity')
    expect(marketingChoice?.extensionTypes).toEqual(['marketing_activity_extension'])
  })

  test('subscription link migration choice has correct extension types', () => {
    const subscriptionChoice = allMigrationChoices.find((choice) => choice.value === 'subscription link')
    expect(subscriptionChoice?.extensionTypes).toEqual(['subscription_link', 'subscription_link_extension'])
  })

  test('admin link migration choice has correct extension types', () => {
    const adminLinkChoice = allMigrationChoices.find((choice) => choice.value === 'link extension')
    expect(adminLinkChoice?.extensionTypes).toEqual(['app_link', 'bulk_action'])
  })
})

describe('getMigrationChoices', () => {
  const mockExtension = (type: string): ExtensionRegistration => ({
    id: '1',
    uuid: 'uuid',
    type,
    title: 'Extension',
  })

  test('returns empty array when no extensions match', () => {
    const extensions = [mockExtension('unknown_type')]
    const result = getMigrationChoices(extensions)
    expect(result).toEqual([])
  })

  test('returns payment migration choice when payment extension is present', () => {
    const extensions = [mockExtension('payments_app')]
    const result = getMigrationChoices(extensions)
    expect(result).toHaveLength(1)
    expect(result[0]?.value).toBe('payments')
  })

  test('returns flow migration choice when flow extension is present', () => {
    const extensions = [mockExtension('flow_action_definition')]
    const result = getMigrationChoices(extensions)
    expect(result).toHaveLength(1)
    expect(result[0]?.value).toBe('flow')
  })

  test('returns multiple migration choices when different extension types are present', () => {
    const extensions = [
      mockExtension('payments_app'),
      mockExtension('flow_trigger_definition'),
      mockExtension('app_link'),
    ]
    const result = getMigrationChoices(extensions)
    expect(result).toHaveLength(3)
    const values = result.map((choice) => choice.value)
    expect(values).toContain('payments')
    expect(values).toContain('flow')
    expect(values).toContain('link extension')
  })

  test('handles case insensitive extension type matching', () => {
    const extensions = [mockExtension('PAYMENTS_APP')]
    const result = getMigrationChoices(extensions)
    expect(result).toHaveLength(1)
    expect(result[0]?.value).toBe('payments')
  })

  test('returns unique migration choices even with multiple extensions of same type', () => {
    const extensions = [
      mockExtension('payments_app'),
      mockExtension('payments_app_credit_card'),
      mockExtension('payments_extension'),
    ]
    const result = getMigrationChoices(extensions)
    expect(result).toHaveLength(1)
    expect(result[0]?.value).toBe('payments')
  })
})

describe('selectMigrationChoice', () => {
  test('returns the only choice when there is exactly one migration choice', async () => {
    const singleChoice: MigrationChoice = {
      label: 'Test Extension',
      value: 'test',
      extensionTypes: ['test_type'],
      buildTomlObject: vi.fn(),
    }
    const result = await selectMigrationChoice([singleChoice])
    expect(result).toBe(singleChoice)
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })

  test('prompts user when there are multiple migration choices', async () => {
    const choices: MigrationChoice[] = [
      {
        label: 'Choice 1',
        value: 'choice1',
        extensionTypes: ['type1'],
        buildTomlObject: vi.fn(),
      },
      {
        label: 'Choice 2',
        value: 'choice2',
        extensionTypes: ['type2'],
        buildTomlObject: vi.fn(),
      },
    ]

    vi.mocked(renderSelectPrompt).mockResolvedValue('choice1')

    const result = await selectMigrationChoice(choices)

    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Extension type to migrate',
      choices: [
        {label: 'Choice 1', value: 'choice1'},
        {label: 'Choice 2', value: 'choice2'},
      ],
    })
    expect(result).toBe(choices[0])
  })

  test('throws AbortError when prompt returns invalid choice', async () => {
    const choices: MigrationChoice[] = [
      {
        label: 'Choice 1',
        value: 'choice1',
        extensionTypes: ['type1'],
        buildTomlObject: vi.fn(),
      },
      {
        label: 'Choice 2',
        value: 'choice2',
        extensionTypes: ['type2'],
        buildTomlObject: vi.fn(),
      },
    ]

    vi.mocked(renderSelectPrompt).mockResolvedValue('invalid_choice')

    await expect(selectMigrationChoice(choices)).rejects.toThrow(AbortError)
    await expect(selectMigrationChoice(choices)).rejects.toThrow('Invalid migration choice')
  })

  test('throws AbortError when passed empty array', async () => {
    await expect(selectMigrationChoice([])).rejects.toThrow(AbortError)
    await expect(selectMigrationChoice([])).rejects.toThrow('Invalid migration choice')
  })

  test('correctly maps choices for prompt', async () => {
    const choices: MigrationChoice[] = [
      {
        label: 'Payments Extensions',
        value: 'payments',
        extensionTypes: ['payments_app'],
        buildTomlObject: vi.fn(),
      },
      {
        label: 'Flow Extensions',
        value: 'flow',
        extensionTypes: ['flow_action_definition'],
        buildTomlObject: vi.fn(),
      },
      {
        label: 'Marketing Activity Extensions',
        value: 'marketing activity',
        extensionTypes: ['marketing_activity_extension'],
        buildTomlObject: vi.fn(),
      },
    ]

    vi.mocked(renderSelectPrompt).mockResolvedValue('flow')

    const result = await selectMigrationChoice(choices)

    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Extension type to migrate',
      choices: [
        {label: 'Payments Extensions', value: 'payments'},
        {label: 'Flow Extensions', value: 'flow'},
        {label: 'Marketing Activity Extensions', value: 'marketing activity'},
      ],
    })
    expect(result).toBe(choices[1])
  })
})
