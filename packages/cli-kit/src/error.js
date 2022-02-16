/**
 * A fatal error represents an error shouldn't be rescued and that causes the execution to terminate.
 * There shouldn't be code that catches fatal errors.
 */
export class Fatal extends Error {
  constructor(message, tryMessage = null) {
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
export function handler(error) {
  return Promise.resolve(error);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlcnJvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sS0FBTSxTQUFRLEtBQUs7SUFFOUIsWUFBWSxPQUFlLEVBQUUsYUFBNEIsSUFBSTtRQUMzRCxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztJQUMvQixDQUFDO0NBQ0Y7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sS0FBTSxTQUFRLEtBQUs7Q0FBRztBQUVuQzs7R0FFRztBQUNILE1BQU0sT0FBTyxHQUFJLFNBQVEsS0FBSztDQUFHO0FBRWpDOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsT0FBTyxDQUFDLEtBQVk7SUFDbEMsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2hDLENBQUMifQ==
