import React from 'react'
import {Box, Text} from 'ink'

// Minimum readable width (in columns) for the description panel when placed beside the list.
// Below this the panel is stacked under the list instead. Shared by SelectInput and
// MultiSelectInput so both make the same responsive decision.
// Bumped from 24 when the panel gained a border: the box edges plus symmetric padding cost 4 columns
// where the old left padding cost 2, so the threshold grows by the same 2 columns to leave the same
// amount of readable text at the breakpoint.
export const MIN_SIDE_PANEL_WIDTH = 26

/**
 * Physical rows the panel's border takes out of the `height` the box occupies: the top and bottom
 * edges. Callers that want the panel's *content* to span N lines must therefore give it
 * `N + PANEL_BORDER_ROWS` lines of height.
 */
export const PANEL_BORDER_ROWS = 2

export interface DescriptionPanelProps {
  /**
   * Optional bold heading shown above the description (typically the highlighted item's label).
   */
  title?: string
  /**
   * The description text to show. Wrapped within the panel's text width and clipped to the lines
   * left inside the box.
   */
  description?: string
  /**
   * Width of the panel in columns, border and padding included: the text gets `width - 4` columns
   * (one border edge plus one padding column on each side).
   */
  width: number
  /**
   * Maximum number of physical lines the panel may occupy, borders included: the text gets
   * `maxLines - PANEL_BORDER_ROWS` lines. The panel always reserves this height so the surrounding
   * layout stays stable while the highlighted item changes, and any overflow is clipped to keep the
   * total render height within the viewport.
   */
  maxLines: number
}

/**
 * A responsive, height-bounded panel that shows the description of the currently highlighted
 * item beside or below a `SelectInput`/`MultiSelectInput` list. Kept intentionally small and
 * self-contained so both selection components can share it.
 *
 * The description is visually contained in a box: `round` + `dim` matches the neutral `info` variant
 * of `Banner`, the existing cli-kit box style, so the panel reads as native and stays quiet next to
 * the list it annotates.
 */
export function DescriptionPanel({title, description, width, maxLines}: DescriptionPanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      width={width}
      height={maxLines}
      overflowY="hidden"
      borderStyle="round"
      borderColor="dim"
      paddingX={1}
    >
      {title ? (
        // `flexShrink={0}` so a description that overflows the box clips its own tail instead of
        // making yoga shrink both children proportionally, which drops the one-line title first —
        // exactly the line worth keeping.
        <Box flexShrink={0}>
          <Text bold wrap="truncate-end">
            {title}
          </Text>
        </Box>
      ) : null}
      {title && description ? (
        // Fixed-height spacer, not compressible by yoga (same reasoning as the title box above).
        // This row is spent from the existing `maxLines` budget, not added on top of it: it is one
        // more line clipped by `overflowY="hidden"` when the description is long and the budget is
        // tight, same as any other interior row.
        <Box flexShrink={0} height={1} />
      ) : null}
      {description ? <Text wrap="wrap">{description}</Text> : null}
    </Box>
  )
}
