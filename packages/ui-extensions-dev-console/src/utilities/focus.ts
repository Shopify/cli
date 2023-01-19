export function focusFirstFocusableNode(element: HTMLElement, onlyDescendants = true) {
  findFirstFocusableNode(element, onlyDescendants)?.focus()
}

function findFirstFocusableNode(element: HTMLElement, onlyDescendants = true): HTMLElement | null {
  const focusableSelector =
    'a,frame,iframe,input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled):not([aria-disabled="true"]):not([tabindex="-1"]),*[tabindex]'

  if (!onlyDescendants && matches(element, focusableSelector)) {
    return element
  }

  return element.querySelector(focusableSelector)
}

function matches(node: HTMLElement, selector: string) {
  if (node.matches) {
    return node.matches(selector)
  }

  const matches = (node.ownerDocument || document).querySelectorAll(selector)
  let i = matches.length
  while (--i >= 0 && matches.item(i) !== node) return i > -1
}
