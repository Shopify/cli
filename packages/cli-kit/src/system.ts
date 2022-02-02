import fs from 'fs';

export async function mkdir(path: fs.PathLike) {
  return fs.promises.mkdir(path, {recursive: true});
}
