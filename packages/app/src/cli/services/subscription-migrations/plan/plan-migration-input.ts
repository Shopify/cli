import {createMigrationPlan} from './create-migration-plan.js'
import {parseMigrationCsv} from './parse-migration-csv.js'
import {loadCsvInput, type LoadCsvInputDependencies} from '../input/load-csv-input.js'
import type {MigrationAction, MigrationPlanResult} from '../../../models/subscription-migrations.js'

export async function planMigrationInput(
  action: MigrationAction,
  input: string,
  dependencies?: LoadCsvInputDependencies,
): Promise<MigrationPlanResult> {
  const content = dependencies ? await loadCsvInput(input, dependencies) : await loadCsvInput(input)
  const parsed = parseMigrationCsv(content, action)
  if (!parsed.ok) return parsed
  return createMigrationPlan(action, parsed.rows)
}
