import {feedbackService, MAX_FEEDBACK_MESSAGE_LENGTH} from './feedback.js'
import {alwaysLogAnalytics, analyticsDisabled} from '@shopify/cli-kit/node/context/local'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {outputResult} from '@shopify/cli-kit/node/output'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')

afterEach(() => {
  vi.unstubAllEnvs()
})

// The test process itself can run under an AI agent that sets SHOPIFY_CLI_AGENT*, which would flip
// the detected source, so tests that expect 'human' clear those variables first.
function clearAgentEnvironmentVariables() {
  Object.keys(process.env)
    .filter((variableName) => variableName.startsWith('SHOPIFY_CLI_AGENT'))
    .forEach((variableName) => vi.stubEnv(variableName, undefined))
}

// The metadata functions receive a callback that produces the data, so we run the callback the
// service passed in to see what it would record.
async function recordedPublicMetadata() {
  return vi.mocked(addPublicMetadata).mock.calls[0]![0]()
}

async function recordedSensitiveMetadata() {
  return vi.mocked(addSensitiveMetadata).mock.calls[0]![0]()
}

describe('feedbackService', () => {
  test('records the dimensions as public metadata and the message as sensitive metadata', async () => {
    clearAgentEnvironmentVariables()

    await feedbackService({message: 'It worked!', sentiment: 'praise', category: 'other', json: false})

    await expect(recordedPublicMetadata()).resolves.toEqual({
      cmd_feedback_sentiment: 'praise',
      cmd_feedback_category: 'other',
      cmd_feedback_message_length: 10,
      cmd_feedback_message_truncated: false,
      cmd_feedback_source: 'human',
    })
    await expect(recordedSensitiveMetadata()).resolves.toEqual({cmd_feedback_message: 'It worked!'})
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Thanks for your feedback.'})
  })

  test('truncates the message at the cap but reports the original length', async () => {
    const longMessage = 'a'.repeat(MAX_FEEDBACK_MESSAGE_LENGTH + 500)

    await feedbackService({message: longMessage, json: false})

    await expect(recordedPublicMetadata()).resolves.toMatchObject({
      cmd_feedback_message_length: MAX_FEEDBACK_MESSAGE_LENGTH + 500,
      cmd_feedback_message_truncated: true,
    })
    await expect(recordedSensitiveMetadata()).resolves.toEqual({
      cmd_feedback_message: 'a'.repeat(MAX_FEEDBACK_MESSAGE_LENGTH),
    })
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Thanks for your feedback.',
      body: expect.stringContaining('truncated'),
    })
  })

  test('does not leave half a surrogate pair when truncation lands inside an emoji', async () => {
    // The emoji is two UTF-16 code units, so the cap cuts straight through it.
    const messageEndingInEmoji = `${'a'.repeat(MAX_FEEDBACK_MESSAGE_LENGTH - 1)}😀`

    await feedbackService({message: messageEndingInEmoji, json: false})

    await expect(recordedSensitiveMetadata()).resolves.toEqual({
      cmd_feedback_message: 'a'.repeat(MAX_FEEDBACK_MESSAGE_LENGTH - 1),
    })
  })

  test('reads the message from stdin when --message - is passed', async () => {
    vi.mocked(readStdinString).mockResolvedValue('piped feedback')

    await feedbackService({message: '-', json: false})

    await expect(recordedSensitiveMetadata()).resolves.toEqual({cmd_feedback_message: 'piped feedback'})
  })

  test('throws when --message - is passed but nothing is piped to stdin', async () => {
    vi.mocked(readStdinString).mockResolvedValue(undefined)

    await expect(feedbackService({message: '-', json: false})).rejects.toThrow(AbortError)
    expect(addPublicMetadata).not.toHaveBeenCalled()
  })

  test('reports the missing stdin message as JSON when --json is passed', async () => {
    vi.mocked(readStdinString).mockResolvedValue(undefined)

    await expect(feedbackService({message: '-', json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({sent: false, reason: 'no_stdin_message'}, null, 2))
  })

  test('throws when the message is only whitespace', async () => {
    await expect(feedbackService({message: '   ', json: false})).rejects.toThrow(AbortError)
    expect(addPublicMetadata).not.toHaveBeenCalled()
  })

  test('reports the empty message as JSON when --json is passed', async () => {
    await expect(feedbackService({message: '   ', json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({sent: false, reason: 'empty_message'}, null, 2))
  })

  test('marks the source as agent when a SHOPIFY_CLI_AGENT variable is present', async () => {
    vi.stubEnv('SHOPIFY_CLI_AGENT', 'claude-code')

    await feedbackService({message: 'sent for the user', json: false})

    await expect(recordedPublicMetadata()).resolves.toMatchObject({cmd_feedback_source: 'agent'})
  })

  test('does not treat SHOPIFY_INVOKED_BY as an agent', async () => {
    clearAgentEnvironmentVariables()
    vi.stubEnv('SHOPIFY_INVOKED_BY', 'some-wrapper')

    await feedbackService({message: 'typed by hand', json: false})

    await expect(recordedPublicMetadata()).resolves.toMatchObject({cmd_feedback_source: 'human'})
  })

  test('outputs a JSON result when --json is passed', async () => {
    await feedbackService({message: 'It worked!', json: true})

    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify({sent: true, messageLength: 10, truncated: false}, null, 2),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('warns instead of confirming when analytics are disabled', async () => {
    vi.mocked(analyticsDisabled).mockReturnValue(true)

    await feedbackService({message: 'It worked!', json: false})

    expect(renderWarning).toHaveBeenCalledWith({
      headline: "Feedback can't be sent because analytics are disabled.",
      body: expect.stringContaining('analytics'),
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('reports sent: false in JSON when analytics are disabled', async () => {
    vi.mocked(analyticsDisabled).mockReturnValue(true)

    await feedbackService({message: 'It worked!', json: true})

    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify({sent: false, reason: 'analytics_disabled', messageLength: 10, truncated: false}, null, 2),
    )
  })

  test('confirms the send when the always-log-analytics override outweighs the opt-out', async () => {
    vi.mocked(analyticsDisabled).mockReturnValue(true)
    vi.mocked(alwaysLogAnalytics).mockReturnValue(true)

    await feedbackService({message: 'It worked!', json: false})

    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Thanks for your feedback.'})
    expect(renderWarning).not.toHaveBeenCalled()
  })
})
