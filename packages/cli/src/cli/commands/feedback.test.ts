import Feedback from './feedback.js'
import {feedbackService} from '../services/commands/feedback.js'
import {describe, expect, test, vi} from 'vitest'

// Only mock the service function itself: the command imports MAX_FEEDBACK_MESSAGE_LENGTH from the
// same module, and that must stay real for the flag descriptions.
vi.mock('../services/commands/feedback.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/commands/feedback.js')>()
  return {...original, feedbackService: vi.fn()}
})

describe('feedback command', () => {
  test('delegates to the feedback service with the parsed flags', async () => {
    await Feedback.run(
      ['--message', 'The docs were wrong', '--sentiment', 'confused', '--category', 'confusing_docs'],
      import.meta.url,
    )

    expect(feedbackService).toHaveBeenCalledWith({
      message: 'The docs were wrong',
      sentiment: 'confused',
      category: 'confusing_docs',
      json: false,
    })
  })

  test('passes --json through to the service', async () => {
    await Feedback.run(['--message', 'It worked!', '--json'], import.meta.url)

    expect(feedbackService).toHaveBeenCalledWith({
      message: 'It worked!',
      sentiment: undefined,
      category: undefined,
      json: true,
    })
  })

  test('fails when --message is missing', async () => {
    await expect(Feedback.run([], import.meta.url)).rejects.toThrow()

    expect(feedbackService).not.toHaveBeenCalled()
  })

  test('rejects a sentiment outside the closed set', async () => {
    await expect(Feedback.run(['--message', 'hi', '--sentiment', 'angry'], import.meta.url)).rejects.toThrow()

    expect(feedbackService).not.toHaveBeenCalled()
  })

  test('rejects a category outside the closed set', async () => {
    await expect(Feedback.run(['--message', 'hi', '--category', 'bad_vibes'], import.meta.url)).rejects.toThrow()

    expect(feedbackService).not.toHaveBeenCalled()
  })
})
