/// <reference types="node" />
import {Environment} from './network/service';
/**
 * Returns true if the CLI is running in debug mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_CONFIG is debug
 */
export declare function isDebug(env?: NodeJS.ProcessEnv): boolean;
/**
 * Returns the environment to be used for the interactions with the partners' CLI API.
 * @param env The environment variables from the environment of the current process.
 */
export declare function partnersApiEnvironment(
  env?: NodeJS.ProcessEnv,
): Environment;
/**
 * Returns the environment to be used for the interactions with the admin API.
 * @param env The environment variables from the environment of the current process.
 */
export declare function adminApiEnvironment(
  env?: NodeJS.ProcessEnv,
): Environment;
/**
 * Returns the environment to be used for the interactions with the storefront renderer API.
 * @param env The environment variables from the environment of the current process.
 */
export declare function storefrontRendererApiEnvironment(
  env?: NodeJS.ProcessEnv,
): Environment;
/**
 * Returns the environment to be used for the interactions with identity.
 * @param env The environment variables from the environment of the current process.
 */
export declare function identityEnvironment(
  env?: NodeJS.ProcessEnv,
): Environment;
