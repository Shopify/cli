import {helpJsonOutputSchema, type HelpResult} from './types.js'
import {Help} from '@oclif/core'
import {BugError} from '@shopify/cli-kit/node/error'
import type {Command, Interfaces} from '@oclif/core'

export async function helpService(config: Interfaces.Config, argv: string[], all = false): Promise<HelpResult> {
  const help = new HelpMetadata(config, {all})
  await help.showHelp(argv)
  if (!help.result) throw new BugError('Oclif did not resolve a help subject.')
  return help.result
}

// Reuse oclif's subject resolution (including space-separated commands, aliases,
// topics, and unknown-command errors), but collect data instead of rendering text.
class HelpMetadata extends Help {
  result?: HelpResult

  async showCommandHelp(command: Command.Loadable): Promise<void> {
    const visible = (entry: {hidden?: boolean}) => this.opts.all === true || !entry.hidden
    this.result = helpJsonOutputSchema.validate({
      kind: 'command',
      command: {
        ...command,
        args: Object.fromEntries(Object.entries(command.args).filter(([, arg]) => visible(arg))),
        flags: Object.fromEntries(Object.entries(command.flags).filter(([, flag]) => visible(flag))),
      },
      ...this.listings(command.id),
    })
  }

  protected async showRootHelp(): Promise<void> {
    this.result = helpJsonOutputSchema.validate({kind: 'root', ...this.listings()})
  }

  protected async showTopicHelp(topic: Interfaces.Topic): Promise<void> {
    this.result = helpJsonOutputSchema.validate({kind: 'topic', topic, ...this.listings(topic.name)})
  }

  private listings(parent?: string) {
    const included = (id: string) => {
      if (parent === undefined) return this.opts.all === true || !id.includes(':')
      return id.startsWith(`${parent}:`) && id.split(':').length === parent.split(':').length + 1
    }
    return {
      commands: this.sortedCommands
        .filter((command) => command.id && included(command.id))
        .map((command) => ({
          id: command.id,
          summary: command.summary ?? command.description?.split('\n')[0],
          hidden: command.hidden ?? false,
        })),
      topics: this.sortedTopics.filter((topic) => included(topic.name)),
    }
  }
}
