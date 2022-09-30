declare module 'chalk-animation' {
  export const rainbow: AnimationFn
  export const pulse: AnimationFn
  export const glitch: AnimationFn
  export const radar: AnimationFn
  export const neon: AnimationFn
  export const karaoke: AnimationFn

  export type AnimationFn = (text: string, speed?: number) => Animation

  export interface Animation {
    text: string[]
    lines: number
    stopped: boolean
    init: boolean
    f: number
    start(): this
    stop(): this
    replace(text: string): this
    render(): this
    frame(): string
  }
}
