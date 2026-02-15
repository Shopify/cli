/**
 * Formatting utilities for Sidekick UI components
 */

/**
 * Formats a Date object into a string like "2:32 PM"
 */
export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Formats a duration in milliseconds into a string like "1.2s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Truncates a string to a maximum number of lines
 */
export function truncateOutput(output: string, maxLines: number): {visible: string; truncated: number} {
  const lines = output.split("\n");
  if (lines.length <= maxLines) {
    return {visible: output, truncated: 0};
  }
  return {
    visible: lines.slice(0, maxLines).join("\n"),
    truncated: lines.length - maxLines,
  };
}

/**
 * Fills a line with a character between two strings
 */
export function fillLine(left: string, right: string, char: string, width: number = process.stdout.columns || 80): string {
  const leftLen = left.length;
  const rightLen = right.length;
  const fillLen = Math.max(0, width - leftLen - rightLen - 2);
  return `${left} ${char.repeat(fillLen)} ${right}`;
}
