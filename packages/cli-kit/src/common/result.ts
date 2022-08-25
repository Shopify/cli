import {Fatal} from '../error.js'

export type Result<T, TError = Error> = {ok: true; value: T} | {ok: false; error: TError}

export type ResultAsync<T, TError = Error> = Promise<Result<T, TError>>

export const ok = <T, TError = Error>(value: T): Result<T, TError> => {
  return {ok: true, value}
}

export const err = <T = never>(error?: unknown): Result<T, Error> => {
  let errorToUse: Error
  if (!error) {
    errorToUse = new Error('Unknown error')
  } else if (error instanceof Error) {
    errorToUse = error
  } else if (typeof error === 'string') {
    errorToUse = new Error(error)
  } else {
    errorToUse = new Error('Unknown error')
  }
  return {ok: false, error: errorToUse}
}

export const valueOrFatal = <T, TError = Error>(result: Result<T, TError>, error: Fatal): T => {
  if (!result.ok) throw error

  return result.value
}
