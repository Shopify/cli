import {analytics, constants, output, semver, store, toml} from '@shopify/cli-kit'
import {Hook} from '@oclif/core'

// This hook is called before each command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Prerun = async (options) => {
  const command = options.Command.id.replace(/:/g, ' ')
  const args = options.argv.join(' ')
  analytics.start({command, args})

  // Catch all errors, as message board failures should never break the CLI.
  try {
    await displayMessageBoard(['cli', command.split(' ')[0]])
    // eslint-disable-next-line no-catch-all/no-catch-all, no-empty
  } catch (err) {}
}

type MessageTopics = 'general' | 'cli' | 'app' | 'hydrogen'

interface Message {
  id: number
  version: string
  content: string
  topic: MessageTopics
}

const MESSAGE_BOARD_URL =
  'https://gist.githubusercontent.com/amcaplan/7d3bb43ab41ffe02487261ad29d0ba70/raw/messages.toml'

const displayMessageBoard = async (topics: string[]): Promise<void> => {
  const response = await fetch(MESSAGE_BOARD_URL)
  const body = await response.text()
  const messages: Message[] = (toml.decode(body) as {messages: Message[]}).messages
  const currentVersion = await constants.versions.cliKit()
  const relevantMessages = messages.filter((msg) => {
    const relevantToVersion = !msg.version || semver.satisfies(currentVersion, msg.version)
    const relevantToTopic = [...topics, 'general'].includes(msg.topic)
    return relevantToVersion && relevantToTopic
  })
  const latestId = store.cliKitStore().getLatestMessageId()
  let message: Message | undefined
  if (latestId) {
    message = relevantMessages.sort((msg1, msg2) => msg1.id - msg2.id).find((msg) => msg.id > latestId)
  } else {
    message = relevantMessages[0]
  }
  if (message) {
    store.cliKitStore().setLatestMessageId(message.id)
    output.messageBoard(message.content)
  } else {
    store.cliKitStore().setLatestMessageId(0)
  }
}
