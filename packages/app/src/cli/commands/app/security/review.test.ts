import SecurityReview from './review.js'
import {appFlags} from '../../../flags.js'
import securityReview from '../../../services/security-review.js'
import {securityReviewJsonOutputSchema} from '../../../services/security-review-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-review.js')

describe('app security review command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(SecurityReview.hidden).toBe(true)
    expect(SecurityReview.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityReview.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityReview.flags.path).toBe(appFlags.path)
    expect(SecurityReview.flags).toHaveProperty('json')
    expect(SecurityReview.jsonOutputSchema).toBe(securityReviewJsonOutputSchema)
  })

  test('reviews the current directory by default', async () => {
    await SecurityReview.run([], import.meta.url)

    expect(securityReview).toHaveBeenCalledWith({directory: cwd(), json: false})
  })

  test('forwards --path and --json', async () => {
    await SecurityReview.run(['--path', './fixtures/app', '--json'], import.meta.url)

    expect(securityReview).toHaveBeenCalledWith({directory: resolvePath('./fixtures/app'), json: true})
  })
})
