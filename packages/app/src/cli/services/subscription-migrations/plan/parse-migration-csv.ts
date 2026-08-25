import {CsvError, parse} from 'csv-parse/sync'
import type {
  MigrationAction,
  MigrationValidationError,
  RawMigrationRow,
} from '../../../models/subscription-migrations.js'

const KNOWN_HEADERS = ['shop_id', 'target_plan_handle', 'price_behavior', 'notification'] as const
const REQUIRED_HEADERS: Record<MigrationAction, ReadonlyArray<string>> = {
  schedule: ['shop_id', 'target_plan_handle', 'price_behavior'],
  unschedule: ['shop_id'],
}

interface CsvRecord {
  shop_id: string
  target_plan_handle?: string
  price_behavior?: string
  notification?: string
}

interface ParsedRecord {
  record: CsvRecord
  info: {lines: number}
}

export type ParseMigrationCsvResult =
  | {ok: true; rows: RawMigrationRow[]}
  | {ok: false; errors: MigrationValidationError[]}

export function parseMigrationCsv(content: string, action: MigrationAction): ParseMigrationCsvResult {
  if (content.trim() === '') {
    return {ok: false, errors: [{message: 'The CSV is empty'}]}
  }

  let headers: string[] = []
  let records: ParsedRecord[]
  try {
    records = parse(content, {
      bom: true,
      columns: (parsedHeaders: string[]) => {
        headers = parsedHeaders
        return parsedHeaders
      },
      info: true,
      skip_empty_lines: true,
      trim: true,
    })
  } catch (error) {
    if (!(error instanceof CsvError)) throw error
    return {ok: false, errors: [{message: `Invalid CSV: ${error.message}`}]}
  }

  const headerErrors = validateHeaders(headers, action)
  if (headerErrors.length > 0) return {ok: false, errors: headerErrors}
  if (records.length === 0) {
    return {ok: false, errors: [{message: 'The CSV must contain at least one data row'}]}
  }

  return {
    ok: true,
    rows: records.map(({record, info}) => mapRecord(record, info.lines, action)),
  }
}

function validateHeaders(headers: string[], action: MigrationAction): MigrationValidationError[] {
  const errors: MigrationValidationError[] = []
  const knownHeaders = new Set<string>(KNOWN_HEADERS)
  const seenHeaders = new Set<string>()

  for (const header of headers) {
    if (seenHeaders.has(header)) {
      errors.push({field: header, message: `Duplicate CSV header: ${header}`})
    } else {
      seenHeaders.add(header)
    }
    if (!knownHeaders.has(header)) {
      errors.push({field: header, message: `Unknown CSV header: ${header}`})
    }
  }

  for (const header of REQUIRED_HEADERS[action]) {
    if (!headers.includes(header)) {
      errors.push({field: header, message: `Missing required CSV header: ${header}`})
    }
  }

  return errors
}

function mapRecord(record: CsvRecord, sourceRow: number, action: MigrationAction): RawMigrationRow {
  if (action === 'unschedule') {
    return {sourceRow, shopId: record.shop_id}
  }

  return {
    sourceRow,
    shopId: record.shop_id,
    ...(record.target_plan_handle === undefined ? {} : {targetPlanHandle: record.target_plan_handle}),
    ...(record.price_behavior === undefined ? {} : {priceBehavior: record.price_behavior}),
    ...(record.notification === undefined ? {} : {notification: record.notification}),
  }
}
