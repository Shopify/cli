import {alwaysLogAnalytics, analyticsDisabled} from '@shopify/cli-kit/node/context/local'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {outputResult} from '@shopify/cli-kit/node/output'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export const MAX_FEEDBACK_MESSAGE_LENGTH = 2000

interface FeedbackServiceOptions {
  message: string
  sentiment?: string
  category?: string
  json: boolean
}

export async function feedbackService(options: FeedbackServiceOptions): Promise<void> {
  const message = (options.message === '-' ? await readMessageFromStdin(options.json) : options.message).trim()
  if (message.length === 0) {
    // In --json mode machine consumers need a parseable failure, so print one and abort silently.
    if (options.json) {
      outputResult(JSON.stringify({sent: false, reason: 'empty_message'}, null, 2))
      throw new AbortSilentError()
    }
    throw new AbortError("The feedback message can't be empty.")
  }

  const truncated = message.length > MAX_FEEDBACK_MESSAGE_LENGTH
  // Truncating can cut a surrogate pair (like an emoji) in half; drop a trailing lone high
  // surrogate so the delivered message stays valid Unicode.
  const deliveredMessage = truncated
    ? message.slice(0, MAX_FEEDBACK_MESSAGE_LENGTH).replace(/[\uD800-\uDBFF]$/, '')
    : message

  await addPublicMetadata(() => ({
    cmd_feedback_sentiment: options.sentiment,
    cmd_feedback_category: options.category,
    cmd_feedback_message_length: message.length,
    cmd_feedback_message_truncated: truncated,
    cmd_feedback_source: feedbackSource(),
  }))
  await addSensitiveMetadata(() => ({cmd_feedback_message: deliveredMessage}))

  // Mirrors the condition under which reportAnalyticsEvent skips the Monorail event, so the user
  // isn't told their feedback was sent when the opt-out will drop it. Best-effort: other silent
  // drops (like the daily analytics rate limit) can't be detected from here.
  const suppressedByOptOut = analyticsDisabled() && !alwaysLogAnalytics()

  if (options.json) {
    outputResult(
      JSON.stringify(
        {
          sent: !suppressedByOptOut,
          ...(suppressedByOptOut ? {reason: 'analytics_disabled'} : {}),
          messageLength: message.length,
          truncated,
        },
        null,
        2,
      ),
    )
    return
  }

  if (suppressedByOptOut) {
    renderWarning({
      headline: "Feedback can't be sent because analytics are disabled.",
      body:
        'Feedback is delivered through the usage analytics the CLI reports. Remove the analytics ' +
        'opt-out (for example, unset SHOPIFY_CLI_NO_ANALYTICS or OPT_OUT_INSTRUMENTATION) and try again.',
    })
    return
  }

  renderSuccess({
    headline: 'Thanks for your feedback.',
    ...(truncated
      ? {body: `The message was longer than ${MAX_FEEDBACK_MESSAGE_LENGTH} characters, so it was truncated.`}
      : {}),
  })
}

async function readMessageFromStdin(json: boolean): Promise<string> {
  const stdinMessage = await readStdinString()
  if (stdinMessage === undefined) {
    // In --json mode machine consumers need a parseable failure, so print one and abort silently.
    if (json) {
      outputResult(JSON.stringify({sent: false, reason: 'no_stdin_message'}, null, 2))
      throw new AbortSilentError()
    }
    throw new AbortError(
      'No feedback message was piped to stdin.',
      'Pipe the message when using --message -, for example: echo "It worked!" | shopify feedback --message -',
    )
  }
  return stdinMessage
}

function feedbackSource(): string {
  // The SHOPIFY_CLI_AGENT* variables mark an AI agent driving the CLI. SHOPIFY_INVOKED_BY marks
  // wrapper tooling rather than an agent, so it deliberately doesn't count here.
  const invokedByAgent = Object.keys(process.env).some((variableName) => variableName.startsWith('SHOPIFY_CLI_AGENT'))
  return invokedByAgent ? 'agent' : 'human'
}
