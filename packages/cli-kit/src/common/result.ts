/* eslint-disable node/handle-callback-err */
export type Result<T, TError> = Ok<T, TError> | Err<T, TError>

export const ok = <T, TError = never>(value: T): Ok<T, TError> => new Ok(value)

export const err = <T = never, TError = unknown>(err: TError): Err<T, TError> => new Err(err)

export class Ok<T, TError> {
  constructor(readonly value: T) {}

  isOk() {
    return true
  }

  isErr() {
    return false
  }

  valueOrThrow(): T {
    return this.value
  }

  mapError<TMappedError>(mapper: (error: TError) => TMappedError): Result<T, TError> {
    return ok(this.value)
  }
}

export class Err<T, TError> {
  constructor(readonly error: TError) {}

  isOk() {
    return false
  }

  isErr() {
    return true
  }

  valueOrThrow(): T {
    throw this.error
  }

  mapError<TMappedError>(mapper: (error: TError) => TMappedError): Result<T, TMappedError> {
    return err(mapper(this.error))
  }
}
