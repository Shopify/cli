import {renderWarning} from '@shopify/cli-kit/node/ui'

interface DeprecatedCommandOptions {
  /** The old command path, without the `shopify` prefix. For example, `app import-extensions`. */
  from: string
  /** The command path that replaces it, without the `shopify` prefix. For example, `app import dashboard-extensions`. */
  to: string
}

/**
 * Warns that a command has moved to a new path.
 *
 * Renamed commands keep their old path working so that existing scripts don't break. This warning is
 * how the people still running the old path find out about the new one.
 *
 * @param options - The old and new command paths.
 */
export function renderDeprecatedCommandWarning({from, to}: DeprecatedCommandOptions): void {
  renderWarning({
    headline: [{command: `shopify ${from}`}, 'has moved.'],
    body: ['This command will be removed in a future release. Use', {command: `shopify ${to}`}, 'instead.'],
  })
}
