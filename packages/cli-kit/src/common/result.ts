export type Result<T, TError = Error> = {ok: true; value: T} | {ok: false; error: TError}

export type ResultAsync<T, TError = Error> = Promise<Result<T, TError>>

export const ok = <T, TError = Error>(value: T): Result<T, TError> => {
  return {ok: true, value}
}

const UnknownError = new Error('Unknown error')

export const err = <T = never>(error?: unknown): Result<T, Error> => {
  let errorToUse: Error
  if (!error) {
    errorToUse = UnknownError
  } else if (error instanceof Error) {
    errorToUse = error
  } else if (typeof error === 'string') {
    errorToUse = new Error(error)
  } else {
    errorToUse = UnknownError
  }
  return {ok: false, error: errorToUse}
}

export const valueOrThrow = <T, TError = Error>(result: Result<T, TError>): T => {
  if (!result.ok) {
    throw result.error
  }

  return result.value
}

export const mapError = <T, TError, TMappedError>(
  result: Result<T, TError>,
  mapper: (error: TError) => TMappedError,
): Result<T, Error> => {
  if (!result.ok) {
    return err(mapper(result.error))
  }

  return result
}
