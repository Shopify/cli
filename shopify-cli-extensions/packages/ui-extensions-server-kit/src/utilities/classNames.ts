export function classNames(...classes: (string | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}
