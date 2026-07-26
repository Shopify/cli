import {Command} from '@oclif/core'

/**
 * The wizard command's own id. It's excluded from the catalog so the wizard can
 * never offer to run itself.
 */
export const WIZARD_COMMAND_ID = 'wizard'

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
 *
 * The match is separator-agnostic: the id and the term are both normalized so that
 * any run of colons or whitespace collapses to a single space. Commands are shown
 * with spaces rather than colons, so a user who types what they see (`app generate`)
 * finds the same commands as one who types the canonical id (`app:generate`).
 */
export function matchesSearchTerm(entry: WizardCatalogEntry, term: string): boolean {
  const normalizedTerm = normalizeForSearch(term)
  if (normalizedTerm.length === 0) return true
  return (
    normalizeForSearch(entry.id).includes(normalizedTerm) || entry.description.toLowerCase().includes(normalizedTerm)
  )
}

/**
 * Filters the catalog to the entries matching a search term.
 */
export function searchCatalog(catalog: WizardCatalogEntry[], term: string): WizardCatalogEntry[] {
  return catalog.filter((entry) => matchesSearchTerm(entry, term))
}

/**
 * A single choice for the discovery search prompt. The `value` is always the real,
 * colon-separated command id — the label is display-only — so the wizard can hand
 * the selection straight to `config.runCommand`.
 *
 * The `description`, when present, is rendered by cli-kit's side/below panel for the
 * highlighted choice rather than inline in the label — this keeps list rows to a
 * single line and avoids wrapping long `id — summary` strings. The `group`, when
 * present, is the top-level topic cli-kit renders the choice under; leaving it
 * undefined puts the choice in cli-kit's automatic "Other" group, which always
 * renders last.
 */
export interface WizardCommandChoice {
  label: string
  value: string
  description?: string
  group?: string
}

/**
 * Builds the choices shown by the discovery search for a given term: the matching
 * commands, each tagged with the topic group it belongs to.
 *
 * Each command choice carries its description separately (not baked into the
 * label) so cli-kit shows it in the description panel; the list itself stays
 * id-only and single-line.
 */
export function commandChoices(catalog: WizardCatalogEntry[], term: string): WizardCommandChoice[] {
  return searchCatalog(catalog, term).map((entry) => ({
    label: commandChoiceLabel(entry),
    value: entry.id,
    description: entry.description.length > 0 ? entry.description : undefined,
    group: groupForEntry(entry, catalog),
  }))
}

/**
 * The label for a command choice: its id with colons rendered as spaces, matching
 * how the command is actually typed on the command line (`app generate extension`
 * rather than `app:generate:extension`). Display only — the choice's `value` keeps
 * the canonical colon id. The description is surfaced separately via the choice's
 * `description` panel, keeping list rows single-line.
 */
export function commandChoiceLabel(entry: WizardCatalogEntry): string {
  return entry.id.split(':').join(' ')
}

/**
 * The topic group a catalog entry is listed under:
 * - a namespaced command (`app:dev`) belongs to its top-level segment (`app`);
 * - a top-level command that other commands nest under (`theme`, with `theme:dev`
 *   in the catalog) is that topic's own parent, so it belongs to its own group;
 * - a standalone top-level command (`upgrade`, `version`) has no topic. Returning
 *   `undefined` hands it to cli-kit's automatic "Other" group, rendered last.
 */
export function groupForEntry(entry: WizardCatalogEntry, catalog: WizardCatalogEntry[]): string | undefined {
  if (entry.id.includes(':')) return entry.topic
  const isTopicParent = catalog.some((candidate) => candidate.id.startsWith(`${entry.id}:`))
  return isTopicParent ? entry.id : undefined
}

/**
 * The sorted, de-duplicated topic names to render groups in. cli-kit needs an
 * explicit order: without one every grouped item sorts equal, leaving the groups
 * interleaved and each item paying its own group title row. Ungrouped entries are
 * excluded — cli-kit appends their "Other" group last on its own.
 */
export function topicOrder(catalog: WizardCatalogEntry[]): string[] {
  const groups = catalog
    .map((entry) => groupForEntry(entry, catalog))
    .filter((group): group is string => group !== undefined)
  return [...new Set(groups)].sort((first, second) => first.localeCompare(second))
}

function topicOfCommandId(id: string): string {
  return id.split(':')[0] ?? id
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim()
}

/**
 * Lowercases and collapses every run of colons or whitespace into a single space,
 * so `app:generate:extension`, `app generate extension` and `APP: GENERATE` all
 * normalize to the same separator-agnostic form.
 */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s:]+/g, ' ')
    .trim()
}
