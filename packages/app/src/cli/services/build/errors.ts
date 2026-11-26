import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * The build output doesn't exist, usually after `deploy --no-build`.
 * A developer condition, not a CLI defect, so it stays out of crash reporting.
 */
export class MissingBuildOutputError extends AbortError {
  constructor(outputPath: string) {
    super(
      `Couldn't find the build output at ${outputPath}`,
      'If you passed --no-build, build the app first. Otherwise check that building the extension produces files at that path.',
    )
  }
}
