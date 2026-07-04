import '@testing-library/jest-dom'

// jsdom does not implement ResizeObserver — required by Radix UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom does not implement PointerEvent fully — required by dnd-kit
if (!global.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
    }
  }
  global.PointerEvent = PointerEvent as typeof globalThis.PointerEvent
}
