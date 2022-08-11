import '@shopify/react-testing/matchers';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),

    // Deprecated
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
});
