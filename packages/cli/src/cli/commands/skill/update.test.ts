import SkillUpdate from './update.js'
import {updateShopifySkill} from '@shopify/cli-kit/node/skills'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/skills')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('skill update', () => {
  test('reports when the skill was updated', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(updateShopifySkill).mockResolvedValue('updated')

    await SkillUpdate.run([], import.meta.url)

    expect(outputMock.info()).toContain('The Shopify skill was updated to the latest version.')
  })

  test('reports when the skill is already up to date', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(updateShopifySkill).mockResolvedValue('already-up-to-date')

    await SkillUpdate.run([], import.meta.url)

    expect(outputMock.info()).toContain('The Shopify skill is already up to date.')
  })

  test('points to skill install when the skill is not installed', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(updateShopifySkill).mockResolvedValue('not-installed')

    await SkillUpdate.run([], import.meta.url)

    expect(outputMock.info()).toContain('Run `shopify skill install` to install it.')
  })
})
