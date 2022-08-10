declare module 'inquirer-autocomplete-prompt' {
    import Prompt from 'inquirer/lib/prompts/base'
    import DistinctChoice from 'inquirer/lib/objects/choices'
    import Paginator from 'inquirer/lib/utils/paginator'
    import inquirer from 'inquirer'

    export class AutocompletePrompt extends Prompt<inquirer.Question<inquirer.Answers>> {
      protected firstRender: boolean

      protected shortAnswer: string

      protected answerName: string

      protected answer: string

      protected searching: boolean

      protected nbChoices: number

      protected currentChoices: DistinctChoice<inquirer.Answers>

      protected selected: number

      protected paginator: Paginator

      // eslint-disable-next-line @typescript-eslint/ban-types
      protected done: Function

      protected ensureSelectedInRange()
    }

    export = AutocompletePrompt
}
