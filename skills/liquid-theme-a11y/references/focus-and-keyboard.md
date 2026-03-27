# Focus & Keyboard Patterns

## Focus Order Principles

1. **DOM order = tab order** — never use positive `tabindex` values
2. `tabindex="0"` makes non-interactive elements focusable (use sparingly)
3. `tabindex="-1"` removes from tab order but allows programmatic focus
4. Never reorder focus with CSS (`order`, `flex-direction: row-reverse`) without matching DOM order

## Focus Trapping

```javascript
class FocusTrap {
  #focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  trap(container) {
    const focusable = container.querySelectorAll(this.#focusableSelector);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    first?.focus();
  }
}
```

## Focus Management Patterns

### Opening a Modal/Drawer

```javascript
openModal(trigger) {
  this.lastFocusedElement = trigger; // Save return target
  this.dialog.showModal();
  const firstFocusable = this.dialog.querySelector(
    'button, [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  firstFocusable?.focus();
}

closeModal() {
  this.dialog.close();
  this.lastFocusedElement?.focus(); // Return focus
}
```

### Dynamic Content Updates

When content is loaded dynamically (AJAX filtering, infinite scroll):

```javascript
async loadContent(url) {
  const response = await fetch(url);
  const html = await response.text();
  this.container.innerHTML = html;

  // Announce to screen readers
  this.liveRegion.textContent = `${resultCount} results loaded`;

  // Move focus to results (not back to filter)
  const firstResult = this.container.querySelector('.result-item');
  firstResult?.focus();
}
```

### Removing an Item

When an item is removed from a list (cart items, wishlist):

```javascript
removeItem(item) {
  const nextItem = item.nextElementSibling || item.previousElementSibling;
  item.remove();

  if (nextItem) {
    nextItem.querySelector('button, a')?.focus();
  } else {
    // List is empty — focus the empty state or heading
    this.emptyMessage?.focus();
  }
}
```

## Keyboard Shortcuts by Component

### Tab List
| Key | Action |
|-----|--------|
| Left/Right Arrow | Move between tabs |
| Home | First tab |
| End | Last tab |
| Enter/Space | Activate tab |

### Carousel
| Key | Action |
|-----|--------|
| Left/Right Arrow | Previous/next slide |
| Enter/Space | Pause/resume auto-rotation |

### Combobox
| Key | Action |
|-----|--------|
| Down Arrow | Open listbox / next option |
| Up Arrow | Previous option |
| Enter | Select current option |
| Escape | Close listbox |

### Modal/Dialog
| Key | Action |
|-----|--------|
| Escape | Close |
| Tab | Cycle through focusable elements (trapped) |
| Shift+Tab | Reverse cycle |

### Dropdown Menu
| Key | Action |
|-----|--------|
| Enter/Space | Open submenu |
| Escape | Close submenu |
| Arrow keys | Navigate items |

## Roving Tabindex Pattern

For widget groups where only one item should be in tab order:

```javascript
class TabList {
  #tabs;
  #activeIndex = 0;

  handleKeydown(event) {
    const { key } = event;
    let newIndex = this.#activeIndex;

    if (key === 'ArrowRight') newIndex++;
    else if (key === 'ArrowLeft') newIndex--;
    else if (key === 'Home') newIndex = 0;
    else if (key === 'End') newIndex = this.#tabs.length - 1;
    else return;

    event.preventDefault();

    // Wrap around
    newIndex = (newIndex + this.#tabs.length) % this.#tabs.length;

    // Update tabindex
    this.#tabs[this.#activeIndex].tabIndex = -1;
    this.#tabs[newIndex].tabIndex = 0;
    this.#tabs[newIndex].focus();

    this.#activeIndex = newIndex;
  }
}
```

Use for: tab lists, radio groups, toolbars, menu bars.

## Screen Reader Announcements

### Pattern: Live Region Update

```javascript
announce(message) {
  // Use existing live region
  const region = document.querySelector('[aria-live="polite"]');
  if (!region) return;

  // Clear and re-set to trigger announcement
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
```

### When to Announce

| Event | Urgency | Method |
|-------|---------|--------|
| Cart item added | Polite | `aria-live="polite"` |
| Form error | Assertive | `role="alert"` |
| Filter results count | Polite | `aria-live="polite"` + `aria-atomic="true"` |
| Page loaded (SPA) | Polite | Update `<title>` + announce |
| Countdown timer | Polite | Update every 30s, not every second |
