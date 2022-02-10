import fs from 'fs';

export async function read(path: fs.PathLike): Promise<string> {
  return fs.promises.readFile(path, {encoding: 'utf-8'});
}

export async function write(path: fs.PathLike, data: string): Promise<void> {
  return fs.promises.writeFile(path, data);
}

export async function mkdir(path: fs.PathLike): Promise<string | undefined> {
  return fs.promises.mkdir(path, {recursive: true});
}

export async function rmdir(path: fs.PathLike): Promise<void> {
  return fs.promises.rm(path, {recursive: true});
}

export async function mkTmpDir(): Promise<string> {
  return fs.promises.mkdtemp('tmp-');
}

export async function isDirectory(path: fs.PathLike): Promise<boolean> {
  return (await fs.promises.lstat(path)).isDirectory();
}

export async function exists(path: fs.PathLike): Promise<boolean> {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
