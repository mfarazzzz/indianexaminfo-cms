import '@testing-library/jest-dom'

// jsdom does not implement ResizeObserver — required by Radix UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom does not implement PointerEvent fully — required by dnd-kit.
// Guarded so `node`-environment tests (e.g. the PGlite parity test, which
// declares `// @vitest-environment node`) can load this shared setup too: MouseEvent
// exists only under jsdom, so the shim is defined only when it does.
if (typeof MouseEvent !== 'undefined' && !global.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
    }
  }
  global.PointerEvent = PointerEvent as typeof globalThis.PointerEvent
}
