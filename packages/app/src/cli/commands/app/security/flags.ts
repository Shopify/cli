import {ignorePatternProblem} from '../../../services/app-security-engine/index.js'
import {Flags} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'

/** Shared so the commands `instructions` generates accept exactly what it was given. */
export const appSecurityFlags = {
  // No environment variable: oclif passes a repeatable flag's variable as one string, so it could hold only one pattern.
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
