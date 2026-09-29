import {ignorePatternProblem} from '../../../services/app-security-engine/index.js'
import {Flags} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Flags shared by `app security check` and `app security instructions`, so
 * the commands that `instructions` generates accept exactly what it was given.
 */
export const appSecurityFlags = {
  // Deliberately not bound to an environment variable: oclif reads a repeatable flag's environment variable only
  // when the command line has no value for it and passes it as one string. It could carry only one pattern, and any
  // --ignore on the command line would silently replace it.
  ignore: Flags.string({
    description:
      'Ignore files that match this .gitignore pattern, relative to the app directory. Start the pattern with ! to include matching files again. Repeat the flag to add patterns; later patterns take precedence.',
    multiple: true,
    parse: async (input) => {
      const problem = ignorePatternProblem(input)
      if (problem) throw new AbortError(problem)
      return input
    },
  }),
}
