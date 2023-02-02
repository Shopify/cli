export interface Position {
  x: number
  y: number
}

export interface TooltipPopoverProps {
  position: Position
  text: string
}

export interface TooltipProps {
  children: JSX.Element
  text: string
}

export interface TooltipState {
  isVisible: boolean
  position: Position
}

export type TooltipAction = {type: 'show' | 'hide'} | {type: 'position'; payload: Position}
