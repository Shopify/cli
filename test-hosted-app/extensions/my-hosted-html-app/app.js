// Simple client-side routing using hash
let currentRoute = '/';

function navigateTo(path) {
  currentRoute = path;
  updateRoute();

  // Notify parent frame about navigation (for hash routing support)
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'HOSTED_APP_NAVIGATION',
      path: path
    }, '*');
  }
}

function updateRoute() {
  const routeDisplay = document.getElementById('current-route');
  if (routeDisplay) {
    routeDisplay.textContent = currentRoute;
  }

  // Simple page content based on route
  const content = document.getElementById('content');
  const routeInfo = document.createElement('div');

  switch(currentRoute) {
    case '/page1':
      routeInfo.innerHTML = '<h3>Page 1</h3><p>This is the first test page.</p>';
      break;
    case '/page2':
      routeInfo.innerHTML = '<h3>Page 2</h3><p>This is the second test page.</p>';
      break;
    default:
      routeInfo.innerHTML = '<p>Current route: <span id="current-route">' + currentRoute + '</span></p>';
  }

  // Keep the route display
  content.innerHTML = '<p>Current route: <span id="current-route">' + currentRoute + '</span></p>';
  content.appendChild(routeInfo);
}

// Listen for navigation updates from parent frame
window.addEventListener('message', (event) => {
  if (event.data.type === 'NAVIGATION_UPDATE') {
    currentRoute = event.data.path || '/';
    updateRoute();
  }
});

// Handle browser hash changes
window.addEventListener('hashchange', () => {
  currentRoute = window.location.hash.slice(1) || '/';
  updateRoute();
});

// Mock API test function
function testAPI() {
  const resultEl = document.getElementById('api-result');
  resultEl.textContent = 'Testing API connection...\n';

  // Simulate API call
  setTimeout(() => {
    const mockData = {
      status: 'success',
      message: 'This would be a real Shopify API call',
      timestamp: new Date().toISOString(),
      features: [
        'Direct API enabled by default',
        'Session token support',
        'GraphQL endpoint access'
      ]
    };

    resultEl.textContent = JSON.stringify(mockData, null, 2);
  }, 500);
}

// Initialize
updateRoute();

console.log('Hosted HTML app loaded successfully!');
console.log('Running in sandboxed iframe:', window.self !== window.top);
