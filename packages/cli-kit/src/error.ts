/**
 * A fatal error represents an error shouldn't be rescued and that causes the execution to terminate.
 * There shouldn't be code that catches fatal errors.
 */
export class Fatal extends Error {
  tryMessage: string | null;
  constructor(message: string, tryMessage: string | null = null) {
    super(message);
    this.tryMessage = tryMessage;
  }
}

/**
 * An abort error is a fatal error that shouldn't be reported as a bug.
 * Those usually represent unexpected scenarios that we can't handle and that usually require some action from the developer
 */
export class Abort extends Fatal {}

/**
 * A bug error is an error that represents a bug and therefore should be reported.
 */
export class Bug extends Fatal {}

/**
 * A function that handles errors that blow up in the CLI.
 * @param error Error to be handled.
 * @returns A promise that resolves with the error passed.
 */
export function handler(error: Error): Promise<Error> {
  console.log(error);
  return Promise.resolve(error);
}
