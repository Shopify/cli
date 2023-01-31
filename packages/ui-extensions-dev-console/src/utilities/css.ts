type Falsy = boolean | undefined | null | 0

export function classNames(...classes: (string | Falsy)[]) {
  return classes.filter(Boolean).join(' ')
}
