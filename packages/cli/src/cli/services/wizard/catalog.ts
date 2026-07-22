import {Command, Interfaces} from '@oclif/core'

/**
 * The wizard command's own id. It's excluded from the catalog so the wizard can
 * never offer to run itself.
 */
export const WIZARD_COMMAND_ID = 'wizard'

/**
 * The sentinel value returned by the discovery search when the user picks the
 * "browse by topic" affordance instead of a real command. Chosen to never collide
 * with a real command id.
 */
export const BROWSE_BY_TOPIC = '__wizard_browse_by_topic__'

/**
 * A single, searchable entry in the wizard's in-memory command index. Built from
 * the loaded oclif `Config` (never from `oclif.manifest.json`) so it always reflects
 * the full catalog, including external plugins.
 */
export interface WizardCatalogEntry {
  /** The canonical oclif command id, colon-separated (eg `app:dev`). */
  id: string
  /** A one-line description/summary, used both for matching and for display. */
  description: string
  /** The top-level topic segment of the id (eg `app` for `app:dev`). */
  topic: string
}

/**
 * A topic the user can browse into as a fallback to searching.
 */
export interface WizardBrowsableTopic {
  name: string
  description: string
}

/**
 * Builds the in-memory command index from the commands exposed by the loaded
 * oclif `Config`. Reads only the metadata available without loading each command
 * (id, summary/description), skips hidden commands and the wizard itself, and
 * sorts by id for a stable, predictable listing.
 */
export function buildCommandCatalog(commands: Command.Loadable[]): WizardCatalogEntry[] {
  return commands
    .filter((command) => !command.hidden && command.id !== WIZARD_COMMAND_ID)
    .map((command) => ({
      id: command.id,
      description: firstLine(command.summary ?? command.description ?? ''),
      topic: topicOfCommandId(command.id),
    }))
    .sort((first, second) => first.id.localeCompare(second.id))
}

/**
 * Case-insensitive substring match against BOTH the command id and its
 * description, so searching for either a name fragment or a concept surfaces the
 * command. An empty term matches everything.
 */
export function matchesSearchTerm(entry: WizardCatalogEntry, term: string): boolean {
  const normalizedTerm = term.trim().toLowerCase()
  if (normalizedTerm.length === 0) return true
  return entry.id.toLowerCase().includes(normalizedTerm) || entry.description.toLowerCase().includes(normalizedTerm)
}

/**
 * Filters the catalog to the entries matching a search term.
 */
export function searchCatalog(catalog: WizardCatalogEntry[], term: string): WizardCatalogEntry[] {
  return catalog.filter((entry) => matchesSearchTerm(entry, term))
}

/**
 * A single choice for the discovery search prompt: either a real command (its
 * `value` is the command id) or the browse-by-topic affordance (its `value` is
 * `BROWSE_BY_TOPIC`). The `description`, when present, is rendered by cli-kit's
 * side/below panel for the highlighted choice rather than inline in the label —
 * this keeps list rows to a single line and avoids wrapping long `id — summary`
 * strings.
 */
export interface WizardCommandChoice {
  label: string
  value: string
  description?: string
}

/**
 * Builds the ordered choices shown by the discovery search for a given term:
 * the matching commands first, then the browse-by-topic affordance APPENDED last.
 *
 * Each command choice carries its description separately (not baked into the
 * label) so cli-kit shows it in the description panel; the list itself stays
 * id-only and single-line.
 *
 * The affordance is deliberately last, not first: cli-kit's select resets the
 * highlight to the first result on every keystroke, so pinning "browse" at the top
 * would make an exact-match search + Enter select "browse" instead of the command
 * the user just typed. Appending it keeps a real command as the default choice.
 */
export function commandChoices(catalog: WizardCatalogEntry[], term: string): WizardCommandChoice[] {
  const matches = searchCatalog(catalog, term).map((entry) => ({
    label: commandChoiceLabel(entry),
    value: entry.id,
    description: entry.description.length > 0 ? entry.description : undefined,
  }))
  return [
    ...matches,
    {
      label: 'Browse commands by topic instead…',
      value: BROWSE_BY_TOPIC,
      description: 'Pick a topic, then a command within it.',
    },
  ]
}

/**
 * The label for a command choice: its id alone. The description is surfaced
 * separately via the choice's `description` panel, keeping list rows single-line.
 */
export function commandChoiceLabel(entry: WizardCatalogEntry): string {
  return entry.id
}

/**
 * Returns the catalog entries that belong to a topic, either as the topic's own
 * command (eg `theme`) or as a command nested under it (eg `theme:dev`).
 */
export function commandsInTopic(catalog: WizardCatalogEntry[], topicName: string): WizardCatalogEntry[] {
  return catalog.filter((entry) => entry.id === topicName || entry.id.startsWith(`${topicName}:`))
}

/**
 * The topics that are worth browsing: non-hidden topics from the `Config` that
 * actually contain at least one visible command in the catalog. Sorted by name.
 */
export function browsableTopics(topics: Interfaces.Topic[], catalog: WizardCatalogEntry[]): WizardBrowsableTopic[] {
  return topics
    .filter((topic) => !topic.hidden && commandsInTopic(catalog, topic.name).length > 0)
    .map((topic) => ({name: topic.name, description: firstLine(topic.description ?? '')}))
    .sort((first, second) => first.name.localeCompare(second.name))
}

function topicOfCommandId(id: string): string {
  return id.split(':')[0] ?? id
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim()
}
