import fs from 'fs';

export {execa as exec} from 'execa';

export function mkdir(path: fs.PathLike) {
  fs.mkdirSync(path, {recursive: true});
}

export function rmdir(path: fs.PathLike) {
  fs.rmSync(path, {recursive: true});
}

export function mkTmpDir(): string {
  return fs.mkdtempSync('tmp-');
}
