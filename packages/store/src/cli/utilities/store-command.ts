import Command from '@shopify/cli-kit/node/base-command'

/**
 * Base class that includes shared behavior for all store commands.
 */
export default abstract class StoreCommand extends Command {
  public abstract run(): Promise<void>
}
