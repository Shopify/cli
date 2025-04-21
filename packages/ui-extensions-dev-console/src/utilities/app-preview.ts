export const isAppPreview = window.top && new URLSearchParams(location.search).get('app-preview') === 'true'
