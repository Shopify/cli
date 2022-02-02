import fs from 'fs';
import type {PathLike} from 'fs';

export const readFile = async (path: string) => {
  return fs.promises.readFile(path, {encoding: 'utf-8'});
};

export const write = async (path: PathLike, data: string) => {
  return fs.promises.writeFile(path, data);
};

export const isDirectory = (path: string) => fs.lstatSync(path).isDirectory();
