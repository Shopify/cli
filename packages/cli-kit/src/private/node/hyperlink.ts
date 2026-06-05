/**
 * Wraps `text` in an OSC-8 terminal hyperlink escape sequence pointing at `url`.
 *
 * See https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda for the
 * OSC-8 spec. The terminal must support hyperlinks for this to render as a link;
 * callers should gate on `supports-hyperlinks` before using it.
 */
export function osc8Link(text: string, url: string): string {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`
}
