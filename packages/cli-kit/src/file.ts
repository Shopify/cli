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

export const isDirectory = (path: string) => fs.lstatSync(path).isDirectory();

export function mkdir(path: fs.PathLike) {
  fs.mkdirSync(path, {recursive: true});
}

export function rmdir(path: fs.PathLike) {
  fs.rmSync(path, {recursive: true});
}

export function mkTmpDir(): string {
  return fs.mkdtempSync('tmp-');
}
