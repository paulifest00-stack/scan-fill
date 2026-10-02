import "@testing-library/jest-dom/vitest";

const createStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
};

const mockLocalStorage = createStorage();
const mockSessionStorage = createStorage();

Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true, configurable: true });
Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true, configurable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: mockSessionStorage, writable: true, configurable: true });
Object.defineProperty(window, "sessionStorage", { value: mockSessionStorage, writable: true, configurable: true });

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

