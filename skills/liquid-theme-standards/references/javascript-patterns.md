# JavaScript Patterns for Shopify Liquid Themes

## Web Component Lifecycle

```javascript
class MyComponent extends HTMLElement {
  #abortController = null;

  connectedCallback() {
    this.#abortController = new AbortController();
    this.#setup();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    // Clean up all resources
  }

  #setup() {
    // Initialize refs, bind events
  }
}

customElements.define('my-component', MyComponent);
```

## Event-Driven Architecture

### Custom Events with Typed Details

```javascript
/**
 * @typedef {Object} CartUpdateDetail
 * @property {number} itemCount - Total items in cart
 * @property {number} totalPrice - Cart total in cents
 */

// Dispatching
/** @type {CustomEvent<CartUpdateDetail>} */
const event = new CustomEvent('cart:updated', {
  detail: { itemCount: 3, totalPrice: 4500 },
  bubbles: true
});
this.dispatchEvent(event);

// Listening
document.addEventListener('cart:updated', (event) => {
  const { itemCount, totalPrice } = event.detail;
  this.#updateDisplay(itemCount, totalPrice);
});
```

### Event Naming Convention

Use `namespace:action` format:
- `cart:item-added`, `cart:updated`, `cart:emptied`
- `variant:selected`, `variant:unavailable`
- `filter:applied`, `filter:cleared`
- `search:submitted`, `search:results-loaded`

## Data Loading Pattern

```javascript
class ProductLoader extends HTMLElement {
  #controller = null;

  async load(url) {
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(url, {
        signal: this.#controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newContent = doc.querySelector('.product-grid');

      if (newContent) {
        this.querySelector('.product-grid')?.replaceWith(newContent);
      }

      return newContent;
    } catch (error) {
      if (error.name === 'AbortError') return null;
      console.error('Load error:', error);
      throw error;
    } finally {
      this.setAttribute('aria-busy', 'false');
    }
  }

  disconnectedCallback() {
    this.#controller?.abort();
  }
}
```

## URL Manipulation

```javascript
// Reading URL parameters
const url = new URL(window.location.href);
const filter = url.searchParams.get('filter');

// Updating URL parameters
const updateURL = (params) => {
  const url = new URL(window.location.href);

  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  }

  history.pushState(null, '', url.toString());
};

// Never do this:
// let url = window.location.pathname + '?filter=' + value;
```

## Optimistic UI

```javascript
async addToCart(variantId) {
  // 1. Update UI immediately
  this.#setButtonState('adding');
  this.#incrementCartCount();

  try {
    // 2. Make request
    const formData = new FormData();
    formData.append('id', variantId);
    formData.append('quantity', '1');

    const response = await fetch('/cart/add.js', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Failed');

    // 3. Confirm success
    this.#setButtonState('added');
  } catch (error) {
    // 4. Revert on failure
    this.#setButtonState('error');
    this.#decrementCartCount();
    console.error('Add to cart failed:', error);
  }
}
```

## Debounce Pattern

```javascript
/**
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Usage: search input (300ms), resize handler (150ms)
const handleSearch = debounce((query) => {
  // Perform search
}, 300);
```

## Intersection Observer (Lazy Loading)

```javascript
class LazyLoader extends HTMLElement {
  #observer;

  connectedCallback() {
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.#loadContent(entry.target);
            this.#observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '200px' }
    );

    for (const el of this.querySelectorAll('[data-lazy]')) {
      this.#observer.observe(el);
    }
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
  }

  #loadContent(element) {
    const src = element.dataset.lazy;
    if (element instanceof HTMLImageElement) {
      element.src = src;
    }
  }
}
```

## JSDoc Type Annotations

```javascript
/**
 * @typedef {Object} ProductData
 * @property {string} id - Product ID
 * @property {string} title - Product title
 * @property {number} price - Price in cents
 * @property {boolean} available - Whether in stock
 * @property {string[]} tags - Product tags
 */

/**
 * Formats a price from cents to display string.
 * @param {number} cents - Price in cents
 * @param {string} [currency='USD'] - Currency code
 * @returns {string} Formatted price
 */
const formatPrice = (cents, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(cents / 100);
};
```

## Error Handling

```javascript
// Always wrap fetch in try/catch
const fetchJSON = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') return null;
    console.error(`Fetch error for ${url}:`, error);
    return null;
  }
};

// Validate DOM elements before use
const getElement = (selector, context = document) => {
  const element = context.querySelector(selector);
  if (!element) {
    console.warn(`Element not found: ${selector}`);
  }
  return element;
};
```

## File Organization

Group related classes in feature files:
```javascript
// cart.js — all cart-related components
class CartDrawer extends HTMLElement { }
class CartItem extends HTMLElement { }
class CartCount extends HTMLElement { }

customElements.define('cart-drawer', CartDrawer);
customElements.define('cart-item', CartItem);
customElements.define('cart-count', CartCount);
```
