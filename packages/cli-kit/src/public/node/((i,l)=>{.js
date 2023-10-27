;((i, l) => {
  if (!window.history.state || !window.history.state.key) {
    let s = Math.random().toString(32).slice(2)
    window.history.replaceState({key: s}, '')
  }
  try {
    let c = JSON.parse(sessionStorage.getItem(i) || '{}')[l || window.history.state.key]
    typeof c == 'number' && window.scrollTo(0, c)
  } catch (s) {
    console.error(s), sessionStorage.removeItem(i)
  }
})('positions', null)
