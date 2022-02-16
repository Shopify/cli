/**
 * Returns the latest available version of an NPM package.
 * @param name {string} The name of the NPM package.
 * @returns A promise to get the latest available version of a package.
 */
export declare function latestNpmPackageVersion(name: string): Promise<string>;
