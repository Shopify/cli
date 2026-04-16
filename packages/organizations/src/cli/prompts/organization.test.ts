import {selectOrganizationPrompt} from './organization.js'
import {describe, expect, test, vi} from 'vitest'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('selectOrganizationPrompt', () => {
  test('auto-selects when there is only one organization', async () => {
    const org = {id: '1234', businessName: 'My Org'}

    const result = await selectOrganizationPrompt([org])

    expect(result).toEqual(org)
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('prompts user when there are multiple organizations', async () => {
    const orgs = [
      {id: '1234', businessName: 'My Org'},
      {id: '5678', businessName: 'Other Org'},
    ]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('5678')

    const result = await selectOrganizationPrompt(orgs)

    expect(result).toEqual({id: '5678', businessName: 'Other Org'})
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which organization do you want to use?',
      choices: [
        {label: 'My Org', value: '1234'},
        {label: 'Other Org', value: '5678'},
      ],
    })
  })

  // Intentional: when ANY duplicates exist, ALL orgs get ID suffix for consistent formatting
  test('appends ID to label when duplicate names exist', async () => {
    const orgs = [
      {id: '1234', businessName: 'My Org'},
      {id: '5678', businessName: 'My Org'},
      {id: '9012', businessName: 'Other Org'},
    ]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('1234')

    const result = await selectOrganizationPrompt(orgs)

    expect(result).toEqual({id: '1234', businessName: 'My Org'})
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which organization do you want to use?',
      choices: [
        {label: 'My Org (1234)', value: '1234'},
        {label: 'My Org (5678)', value: '5678'},
        {label: 'Other Org (9012)', value: '9012'},
      ],
    })
  })

  test('appends ID to all labels when all names are identical', async () => {
    const orgs = [
      {id: '1234', businessName: 'Same Org'},
      {id: '5678', businessName: 'Same Org'},
    ]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('5678')

    const result = await selectOrganizationPrompt(orgs)

    expect(result).toEqual({id: '5678', businessName: 'Same Org'})
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which organization do you want to use?',
      choices: [
        {label: 'Same Org (1234)', value: '1234'},
        {label: 'Same Org (5678)', value: '5678'},
      ],
    })
  })

  test('preserves extra properties on the returned organization', async () => {
    const orgs = [
      {id: '1234', businessName: 'My Org', source: 'BusinessPlatform'},
      {id: '5678', businessName: 'Other Org', source: 'BusinessPlatform'},
    ]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('5678')

    const result = await selectOrganizationPrompt(orgs)

    expect(result).toEqual({id: '5678', businessName: 'Other Org', source: 'BusinessPlatform'})
  })
})
