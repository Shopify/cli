import {
  BROWSE_BY_TOPIC,
  browsableTopics,
  buildCommandCatalog,
  commandChoiceLabel,
  commandChoices,
  commandsInTopic,
} from '../services/wizard/catalog.js'
import {
  optionalFlagParameters,
  requiredArgParameters,
  requiredFlagGroups,
  requiredFlagParameters,
  validateInteger,
  validateNonEmpty,
  WizardArgParameter,
  WizardFlagGroup,
  WizardFlagParameter,
} from '../services/wizard/parameters.js'
import {
  assembleCommandTokens,
  previewCommandLine,
  WizardArgAnswer,
  WizardFlagAnswer,
} from '../services/wizard/command-line.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderInfo,
  renderMultiSelectPrompt,
  renderSelectPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Command as OclifCommand} from '@oclif/core'

// Re-exported for callers that key off the browse-by-topic sentinel; the source
// of truth lives with the rest of the catalog logic.
export {BROWSE_BY_TOPIC}

export default class Wizard extends Command {
  static description =
    'Guided, interactive walkthrough that helps you find a CLI command, fill in its parameters, and run it.'

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    if (!terminalSupportsPrompting()) {
      throw new AbortError(
        'The wizard is interactive and needs a terminal that supports prompting.',
        'Run the target command directly instead.',
      )
    }
    await this.parse(Wizard)

    const commandId = await this.discoverCommandId()
    const commandClass = await this.loadCommand(commandId)

    const argAnswers = await this.fillRequiredArgs(commandClass)
    const flagAnswers = await this.fillRequiredFlags(commandClass)
    const {answers: groupAnswers, excludedNames} = await this.fillRequiredGroups(commandClass)
    flagAnswers.push(...groupAnswers)
    flagAnswers.push(...(await this.fillOptionalFlags(commandClass, excludedNames)))

    const tokens = assembleCommandTokens(argAnswers, flagAnswers)
    const shouldRun = await this.confirmRun(commandId, tokens)
    if (!shouldRun) {
      renderInfo({body: 'No problem — nothing was run.'})
      return
    }

    // Hand off to the target command. It re-parses and validates the tokens, runs
    // its own runtime prompts (eg selecting a store or app), and renders its own
    // output and errors. The wizard deliberately does none of that itself.
    await this.config.runCommand(commandId, tokens)
  }

  private async discoverCommandId(): Promise<string> {
    const catalog = buildCommandCatalog(this.config.commands)

    const selected = await renderAutocompletePrompt({
      message: 'Search for a command to run',
      choices: commandChoices(catalog, ''),
      search: (term: string) => Promise.resolve({data: commandChoices(catalog, term)}),
      // The catalog is filtered locally, so there's no reason to debounce keystrokes.
      searchDebounceMs: 0,
    })

    if (selected === BROWSE_BY_TOPIC) {
      return this.browseByTopic(catalog)
    }
    return selected
  }

  private async browseByTopic(catalog: ReturnType<typeof buildCommandCatalog>): Promise<string> {
    const topics = browsableTopics(this.config.topics, catalog)
    if (topics.length === 0) {
      throw new AbortError('There are no topics to browse.')
    }

    const topicName = await renderSelectPrompt({
      message: 'Which topic?',
      choices: topics.map((topic) => ({
        label: topic.description.length > 0 ? `${topic.name}  ${topic.description}` : topic.name,
        value: topic.name,
      })),
    })

    return renderSelectPrompt({
      message: `Which command in "${topicName}"?`,
      choices: commandsInTopic(catalog, topicName).map((entry) => ({
        label: commandChoiceLabel(entry),
        value: entry.id,
      })),
    })
  }

  private async loadCommand(commandId: string): Promise<OclifCommand.Class> {
    const loadable = this.config.findCommand(commandId)
    if (!loadable) {
      throw new AbortError(`Couldn't find the command "${commandId}".`)
    }
    return loadable.load()
  }

  private async fillRequiredArgs(commandClass: OclifCommand.Class): Promise<WizardArgAnswer[]> {
    const answers: WizardArgAnswer[] = []
    for (const parameter of requiredArgParameters(commandClass.args ?? {})) {
      // eslint-disable-next-line no-await-in-loop
      const value = await this.promptForArg(parameter)
      answers.push({name: parameter.name, value})
    }
    return answers
  }

  private async fillRequiredFlags(commandClass: OclifCommand.Class): Promise<WizardFlagAnswer[]> {
    const answers: WizardFlagAnswer[] = []
    for (const parameter of requiredFlagParameters(commandClass.flags ?? {})) {
      // eslint-disable-next-line no-await-in-loop
      answers.push(await this.promptForFlag(parameter))
    }
    return answers
  }

  /**
   * Fills oclif's `exactlyOne` / `atLeastOne` required groups. Their members are
   * each declared `required: false`, so the normal required pass skips them; without
   * this step the wizard would hand off an argv the target immediately rejects.
   * Returns the answers plus the member names to exclude from the optional step.
   */
  private async fillRequiredGroups(
    commandClass: OclifCommand.Class,
  ): Promise<{answers: WizardFlagAnswer[]; excludedNames: Set<string>}> {
    const answers: WizardFlagAnswer[] = []
    const excludedNames = new Set<string>()

    for (const group of requiredFlagGroups(commandClass.flags ?? {})) {
      if (group.kind === 'exactlyOne') {
        // eslint-disable-next-line no-await-in-loop
        const chosenName = await renderSelectPrompt({
          message: 'Provide one of these flags:',
          choices: group.members.map((member) => ({label: flagLabel(member), value: member.name})),
        })
        const chosen = group.members.find((member) => member.name === chosenName)
        if (chosen) {
          // eslint-disable-next-line no-await-in-loop
          answers.push(await this.promptForFlag(chosen))
        }
        // Exactly one member may be set, so none of them belong in the optional step.
        for (const member of group.members) excludedNames.add(member.name)
      } else {
        // eslint-disable-next-line no-await-in-loop
        const chosenNames = await this.selectAtLeastOne(group)
        for (const name of chosenNames) {
          const member = group.members.find((candidate) => candidate.name === name)
          if (!member) continue
          // eslint-disable-next-line no-await-in-loop
          answers.push(await this.promptForFlag(member))
          // Only the chosen members are handled; the rest stay legitimately optional.
          excludedNames.add(name)
        }
      }
    }
    return {answers, excludedNames}
  }

  private async selectAtLeastOne(group: WizardFlagGroup): Promise<string[]> {
    const choices = group.members.map((member) => ({label: flagLabel(member), value: member.name}))
    let chosen = await renderMultiSelectPrompt({message: 'Provide at least one of these flags:', choices})
    while (chosen.length === 0) {
      renderInfo({body: 'Pick one or more flags to continue.'})
      // eslint-disable-next-line no-await-in-loop
      chosen = await renderMultiSelectPrompt({message: 'Provide at least one of these flags:', choices})
    }
    return chosen
  }

  private async fillOptionalFlags(
    commandClass: OclifCommand.Class,
    excludedNames: Set<string>,
  ): Promise<WizardFlagAnswer[]> {
    const optional = optionalFlagParameters(commandClass.flags ?? {}).filter(
      (parameter) => !excludedNames.has(parameter.name),
    )
    if (optional.length === 0) return []

    const wantsOptional = await renderConfirmationPrompt({
      message: 'Do you want to set any optional flags?',
      confirmationMessage: 'Yes, set optional flags',
      cancellationMessage: 'No, run with just the required ones',
      defaultValue: false,
    })
    if (!wantsOptional) return []

    const selectedNames = await renderMultiSelectPrompt({
      message: 'Which optional flags do you want to set?',
      choices: optional.map((parameter) => ({
        label: flagLabel(parameter),
        value: parameter.name,
      })),
    })

    const answers: WizardFlagAnswer[] = []
    for (const name of selectedNames) {
      const parameter = optional.find((candidate) => candidate.name === name)
      if (!parameter) continue
      if (parameter.kind === 'boolean') {
        // eslint-disable-next-line no-await-in-loop
        answers.push(await this.answerOptionalBoolean(parameter))
      } else {
        // eslint-disable-next-line no-await-in-loop
        answers.push(await this.promptForFlag(parameter))
      }
    }
    return answers
  }

  /**
   * Resolves an optional boolean the user checked in the multi-select. A negatable
   * flag (`allowNo`, eg a `--watch` that defaults to true) needs a follow-up so the
   * user can express the negated `--no-<name>` form; a plain boolean is fully
   * answered by the checkbox itself.
   */
  private async answerOptionalBoolean(parameter: WizardFlagParameter): Promise<WizardFlagAnswer> {
    if (!parameter.allowNo) {
      return {name: parameter.name, kind: 'boolean', value: true}
    }
    const enabled = await renderConfirmationPrompt({
      message: `Use --${parameter.name}?`,
      // Default to flipping the flag's current default — that's the usual reason to
      // reach for a negatable flag in the first place.
      defaultValue: !(parameter.defaultValue ?? false),
    })
    return {name: parameter.name, kind: 'boolean', value: enabled, allowNo: true}
  }

  private async promptForFlag(parameter: WizardFlagParameter): Promise<WizardFlagAnswer> {
    switch (parameter.kind) {
      case 'boolean': {
        const value = await renderConfirmationPrompt({
          message: flagMessage(parameter),
          defaultValue: parameter.defaultValue ?? false,
        })
        if (value === false && !parameter.allowNo) {
          // The flag has no `--no-<name>` form, so a "no" answer can't be expressed
          // in argv. Fail loudly rather than silently dropping the user's choice.
          throw new AbortError(
            `The --${parameter.name} flag can only be turned on, so "no" can't be passed through.`,
            'Re-run the wizard and turn it on, or run the target command directly.',
          )
        }
        return {name: parameter.name, kind: 'boolean', value, allowNo: parameter.allowNo}
      }
      case 'enum': {
        const value = await renderSelectPrompt({
          message: flagMessage(parameter),
          choices: (parameter.options ?? []).map((option) => ({label: option, value: option})),
        })
        return {name: parameter.name, kind: 'enum', value}
      }
      case 'integer': {
        const value = await renderTextPrompt({
          message: flagMessage(parameter),
          validate: validateInteger,
        })
        return {name: parameter.name, kind: 'integer', value}
      }
      case 'string': {
        const value = await renderTextPrompt({
          message: flagMessage(parameter),
          validate: validateNonEmpty,
        })
        return {name: parameter.name, kind: 'string', value}
      }
      default:
        // Exhaustiveness guard: a new WizardPromptKind must add a case above.
        return assertNeverPromptKind(parameter.kind)
    }
  }

  private async promptForArg(parameter: WizardArgParameter): Promise<string> {
    if (parameter.kind === 'enum') {
      return renderSelectPrompt({
        message: argMessage(parameter),
        choices: (parameter.options ?? []).map((option) => ({label: option, value: option})),
      })
    }
    return renderTextPrompt({
      message: argMessage(parameter),
      validate: validateNonEmpty,
    })
  }

  private async confirmRun(commandId: string, tokens: string[]): Promise<boolean> {
    const preview = previewCommandLine(this.config.bin, commandId, tokens)
    return renderConfirmationPrompt({
      message: ['Run this command?', {command: preview}],
      confirmationMessage: 'Yes, run it',
      cancellationMessage: 'No, cancel',
      defaultValue: true,
    })
  }
}

function flagLabel(parameter: WizardFlagParameter): string {
  return parameter.description ? `--${parameter.name}  ${parameter.description}` : `--${parameter.name}`
}

// Prompt messages are deliberately generic and controlled: the flag/arg's own
// description is shown in labels, never interpolated into the prompt message, so a
// command's free-text summary can't leak wording (or trailing punctuation) into a
// prompt the wizard is responsible for phrasing.
//
// Note: an over-long label (a command with a lengthy description) can wrap across
// lines in narrow terminals. That's a cosmetic display concern only.
function flagMessage(parameter: WizardFlagParameter): string {
  if (parameter.kind === 'boolean') return `Use --${parameter.name}?`
  return `Value for --${parameter.name}:`
}

// Note: only REQUIRED positional args are prompted for, and hidden args are
// skipped by the parameter layer. A hidden positional arg declared before a
// visible one could in theory shift positions, and optional positional args are
// not fillable by the wizard — both are documented thin-wizard limitations.
function argMessage(parameter: WizardArgParameter): string {
  return `Value for ${parameter.name}:`
}

function assertNeverPromptKind(kind: never): never {
  throw new AbortError(`Unsupported flag prompt kind: ${String(kind)}`)
}
