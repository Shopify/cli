import fs from 'fs-extra'
import del from 'del'
import tempy from 'tempy'

/**
 * Creates a temporary directory and ties its lifecycle ot the lifecycle of the callback.
 * @param callback - The callback that receives the temporary directory.
 */
export async function inTemporaryDirectory<T>(callback: (tmpDir: string) => T | Promise<T>): Promise<T> {
  return tempy.directory.task(callback)
}

/**
 * It reads a file and returns its content as a string using the
 * utf-8 encoding
 * @param path {string} Path to the file to read.
 * @returns {Promise<string>} A promise that resolves with the content of the file.
 */
export async function read(path: string): Promise<string> {
  const content = await fs.readFile(path, {encoding: 'utf-8'})
  return content
}

/**
 * Copies a file
 * @param from {string} Path to the directory or file to be copied.
 * @param to {string} Destination path.
 */
export async function copy(from: string, to: string): Promise<void> {
  await fs.copy(from, to)
}

export async function write(path: string, data: string): Promise<void> {
  await fs.writeFile(path, data)
}

export async function append(path: string, data: string): Promise<void> {
  await fs.appendFile(path, data)
}

export async function mkdir(path: string): Promise<void> {
  await fs.mkdirp(path)
}

export async function rmdir(path: string): Promise<void> {
  await del(path)
}

export async function mkTmpDir(): Promise<string> {
  const directory = await fs.mkdtemp('tmp-')
  return directory
}

export async function isDirectory(path: string): Promise<boolean> {
  return (await fs.promises.lstat(path)).isDirectory()
}

/**
 * Moves a file.
 * @param src {string} File to be moved.
 * @param dest {string} Path to be moved to.
 * @param options {object} Moving options.
 */
export async function move(src: string, dest: string, options: {overwrite?: boolean} = {}): Promise<void> {
  await fs.move(src, dest, options)
}

/**
 * Changes the permissions of a directory or file.
 * @param path {string} Path to the file or directory whose permissions will be modified.
 * @param mode {string | numbers} Permissions to set to the file or directory.
 */
export async function chmod(path: string, mode: number | string): Promise<void> {
  await fs.promises.chmod(path, mode)
}

/**
 * Checks if a file has executable permissions.
 * @param path {string} Path to the file whose permissions will be checked.
 */
export async function hasExecutablePermissions(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path, fs.constants.X_OK)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Returns true if a file or directory exists
 * @param path {string} Path to the directory or file.
 * @returns {boolean} True if it exists.
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
