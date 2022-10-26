/* eslint-disable node/handle-callback-err */
export type Result<TValue, TError> = Ok<TValue, TError> | Err<TValue, TError>

export const ok = <TValue, TError = never>(value: TValue): Ok<TValue, TError> => new Ok(value)

export const err = <TValue = never, TError = unknown>(err: TError): Err<TValue, TError> => new Err(err)

export class Ok<TValue, TError> {
  constructor(readonly value: TValue) {}

  isErr(): this is Err<TValue, TError> {
    return false
  }

  doOnOk(handler: (value: TValue) => void): Result<TValue, TError> {
    handler(this.value)
    return ok(this.value)
  }

  valueOrThrow(): TValue {
    return this.value
  }

  map<TMappedValue>(mapper: (value: TValue) => TMappedValue): Result<TMappedValue, TError> {
    return ok(mapper(this.value))
  }

  mapError<TMappedError>(_mapper: (error: TError) => TMappedError): Result<TValue, TMappedError> {
    return ok(this.value)
  }
}

export class Err<TValue, TError> {
  constructor(readonly error: TError) {}

  isErr(): this is Err<TValue, TError> {
    return true
  }

  doOnOk(_handler: (value: TValue) => void): Result<TValue, TError> {
    return err(this.error)
  }

  valueOrThrow(): TValue {
    throw this.error
  }

  map<TMappedValue>(_mapper: (valueOrThrow: TValue) => TMappedValue): Result<TMappedValue, TError> {
    return err(this.error)
  }

  mapError<TMappedError>(mapper: (error: TError) => TMappedError): Result<TValue, TMappedError> {
    return err(mapper(this.error))
  }
}
