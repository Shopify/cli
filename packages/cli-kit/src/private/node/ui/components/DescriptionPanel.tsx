import React from 'react'
import {Box, Text} from 'ink'

// Minimum readable width (in columns) for the description panel when placed beside the list.
// Below this the panel is stacked under the list instead. Shared by SelectInput and
// MultiSelectInput so both make the same responsive decision.
export const MIN_SIDE_PANEL_WIDTH = 24

// Number of physical lines the description panel occupies when stacked below the list. Kept small
// so the combined list + panel height stays within the viewport.
export const DESCRIPTION_PANEL_LINES_BELOW = 5

export interface DescriptionPanelProps {
  /**
   * Optional bold heading shown above the description (typically the highlighted item's label).
   */
  title?: string
  /**
   * The description text to show. Wrapped within the panel width and clipped to `maxLines`.
   */
  description?: string
  /**
   * Width of the panel in columns. Includes the panel's left padding.
   */
  width: number
  /**
   * Maximum number of physical lines the panel may occupy. The panel always reserves this
   * height so the surrounding layout stays stable while the highlighted item changes, and any
   * overflow is clipped to keep the total render height within the viewport.
   */
  maxLines: number
}

/**
 * A responsive, height-bounded panel that shows the description of the currently highlighted
 * item beside or below a `SelectInput`/`MultiSelectInput` list. Kept intentionally small and
 * self-contained so both selection components can share it.
 */
export function DescriptionPanel({title, description, width, maxLines}: DescriptionPanelProps): React.ReactElement {
  return (
    <Box flexDirection="column" width={width} height={maxLines} overflowY="hidden" paddingLeft={2}>
      {title ? (
        <Text bold wrap="truncate-end">
          {title}
        </Text>
      ) : null}
      {description ? <Text wrap="wrap">{description}</Text> : null}
    </Box>
  )
}
