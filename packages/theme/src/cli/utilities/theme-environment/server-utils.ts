import {H3Event} from 'h3'

export function parseServerEvent(event: H3Event) {
  const {pathname, search, searchParams} = new URL(event.path, 'http://e.c')
  return {pathname, search, searchParams}
}
