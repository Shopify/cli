import fs from 'fs';

export function read(path: string): string {
  return fs.readFileSync(path, 'utf-8');
}

export function write(path: fs.PathLike, data: string) {
  return fs.writeFileSync(path, data);
}

export function exists(path: fs.PathLike) {
  return fs.existsSync(path);
}

export async function mkdir(path: fs.PathLike) {
  return fs.promises.mkdir(path, {recursive: true});
}

export const isDirectory = (path: string) => fs.lstatSync(path).isDirectory();
