import {Fatal} from '../error.js'

export type Result<T, TError = Error> = {ok: true; value: T} | {ok: false; error: TError}

export const ok = <T, TError = Error>(value: T): Result<T, TError> => {
  return {ok: true, value}
}

export const err = <T, TError = Error>(error: TError): Result<T, TError> => {
  return {ok: false, error}
}

export const valueOrFatal = <T, TError = Error>(result: Result<T, TError>, error: Fatal): T => {
  if (!result.ok) throw error

  return result.value
}
