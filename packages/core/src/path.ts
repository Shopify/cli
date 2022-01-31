import findUp from 'find-up';

export function findPathUp(
  path: string,
  from: string,
  type: 'file' | 'directory',
): Promise<string | undefined> {
  return findUp(path, {cwd: from, type});
}
