export const isEmbedded = window.top && new URLSearchParams(location.search).get('embedded') === 'true'
