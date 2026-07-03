export const palette = {
  border: '#C9A0FF',
  header: '#D8B4FE',
  accent: '#F49AC2',
  role: '#A7E8BD',
  text: '#E7E0F0',
  subdued: '#8B8296',
  methods: {
    // reuse role green — safe/read verb
    get: '#A7E8BD',
    // NEW pastel blue — create/write verb
    post: '#8FB8FF',
    // NEW pastel amber — update verb (PUT/PATCH share)
    put: '#F4C77B',
    // reuse accent pink — destructive verb
    delete: '#F49AC2',
    // reuse subdued — HEAD/OPTIONS/unknown
    other: '#8B8296',
  },
  status: {
    // 2xx — reuse role green
    success: '#A7E8BD',
    // 3xx — reuse the NEW amber
    redirect: '#F4C77B',
    // 4xx/5xx — reuse accent pink (soft red, Charm-coherent)
    error: '#F49AC2',
  },
} as const

// Only the flat string tokens are addressable as a PaletteColor; the nested
// methods/status groups are referenced directly (e.g. palette.methods.get) and
// intentionally excluded so single-string consumers keep a string union.
export type PaletteColor =
  | typeof palette.border
  | typeof palette.header
  | typeof palette.accent
  | typeof palette.role
  | typeof palette.text
  | typeof palette.subdued
