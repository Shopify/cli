import fs from 'fs-extra';

export async function read(path: string): Promise<string> {
  return fs.readFile(path, {encoding: 'utf-8'});
}

export async function write(path: string, data: string): Promise<void> {
  return fs.writeFile(path, data);
}

export async function mkdir(path: string): Promise<void> {
  return fs.mkdirp(path);
}

export async function rmdir(path: string): Promise<void> {
  return fs.rm(path, {recursive: true});
}

export async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp('tmp-');
}

export async function isDirectory(path: string): Promise<boolean> {
  return (await fs.promises.lstat(path)).isDirectory();
}

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
