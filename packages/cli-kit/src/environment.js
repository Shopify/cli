import constants from './constants';
import {Environment} from './network/service';
/**
 * Given an environment variable that represents the environment to use for a given serve,
 * it returns the environment as a enum;
 * @param value The environment variable value.
 * @returns {ServiceEnvironment} representing the environment to use.
 */
function serviceEnvironment(value) {
  if (value === 'local') {
    return Environment.Local;
  } else if (value === 'spin') {
    return Environment.Spin;
  } else {
    return Environment.Production;
  }
}
function isTruthy(variable) {
  if (!variable) {
    return false;
  }
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(variable);
}
/**
 * Returns true if the CLI is running in debug mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_CONFIG is debug
 */
export function isDebug(env = process.env) {
  return isTruthy(env[constants.environmentVariables.debug]);
}
/**
 * Returns the environment to be used for the interactions with the partners' CLI API.
 * @param env The environment variables from the environment of the current process.
 */
export function partnersApiEnvironment(env = process.env) {
  return serviceEnvironment(env[constants.environmentVariables.partnersApiEnv]);
}
/**
 * Returns the environment to be used for the interactions with the admin API.
 * @param env The environment variables from the environment of the current process.
 */
export function adminApiEnvironment(env = process.env) {
  return serviceEnvironment(env[constants.environmentVariables.adminApiEnv]);
}
/**
 * Returns the environment to be used for the interactions with the storefront renderer API.
 * @param env The environment variables from the environment of the current process.
 */
export function storefrontRendererApiEnvironment(env = process.env) {
  return serviceEnvironment(
    env[constants.environmentVariables.storefrontRendererApiEnv],
  );
}
/**
 * Returns the environment to be used for the interactions with identity.
 * @param env The environment variables from the environment of the current process.
 */
export function identityEnvironment(env = process.env) {
  return serviceEnvironment(env[constants.environmentVariables.identityEnv]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnZpcm9ubWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLFNBQVMsTUFBTSxhQUFhLENBQUM7QUFDcEMsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRTlDOzs7OztHQUtHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxLQUF5QjtJQUNuRCxJQUFJLEtBQUssS0FBSyxPQUFPLEVBQUU7UUFDckIsT0FBTyxXQUFXLENBQUMsS0FBSyxDQUFDO0tBQzFCO1NBQU0sSUFBSSxLQUFLLEtBQUssTUFBTSxFQUFFO1FBQzNCLE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQztLQUN6QjtTQUFNO1FBQ0wsT0FBTyxXQUFXLENBQUMsVUFBVSxDQUFDO0tBQy9CO0FBQ0gsQ0FBQztBQUVELFNBQVMsUUFBUSxDQUFDLFFBQTRCO0lBQzVDLElBQUksQ0FBQyxRQUFRLEVBQUU7UUFDYixPQUFPLEtBQUssQ0FBQztLQUNkO0lBQ0QsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDaEUsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsT0FBTyxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRztJQUN2QyxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDN0QsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUc7SUFDdEQsT0FBTyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFDaEYsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUc7SUFDbkQsT0FBTyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDN0UsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxnQ0FBZ0MsQ0FDOUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHO0lBRWpCLE9BQU8sa0JBQWtCLENBQ3ZCLEdBQUcsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsd0JBQXdCLENBQUMsQ0FDN0QsQ0FBQztBQUNKLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHO0lBQ25ELE9BQU8sa0JBQWtCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0FBQzdFLENBQUMifQ==
