// A shopify-object alias used for NON-intercept reasons. The simple detector
// must NOT warn here — it only flags aliases when `.intercept` is accessed.
declare const shopify: {intercept: (e: string, h: () => void) => void; toast: {show: (m: string) => void}}
const s = shopify
s.toast.show('hi')
