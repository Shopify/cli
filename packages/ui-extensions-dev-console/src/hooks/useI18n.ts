import React from 'react'

type TranslationDictionary = Record<string, unknown>
type Replacements = Record<string, string | number | React.ReactNode>

interface I18nTranslator {
  translate(key: string, replacements?: Replacements): React.ReactNode
}

function getNestedValue(obj: TranslationDictionary, key: string): string | undefined {
  const result = key.split('.').reduce<unknown>((current, segment) => {
    if (current != null && typeof current === 'object') {
      return (current as TranslationDictionary)[segment]
    }
    return undefined
  }, obj)
  return typeof result === 'string' ? result : undefined
}

function interpolate(template: string, replacements?: Replacements): React.ReactNode {
  if (!replacements) return template

  const hasReactNodes = Object.values(replacements).some((value) => React.isValidElement(value))

  if (!hasReactNodes) {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in replacements ? String(replacements[key]) : match,
    )
  }

  const parts: React.ReactNode[] = []
  const regex = /\{(\w+)\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index))
    }
    const key = match[1]
    parts.push(key in replacements ? replacements[key] : match[0])
    lastIndex = regex.lastIndex
  }

  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex))
  }

  return React.createElement(React.Fragment, null, ...parts)
}

export function useI18n({fallback}: {id: string; fallback: TranslationDictionary}): [I18nTranslator] {
  return [
    {
      translate(key: string, replacements?: Replacements) {
        const template = getNestedValue(fallback, key)
        if (template == null) return key
        return interpolate(template, replacements)
      },
    },
  ]
}
