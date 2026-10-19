import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Service worker lifecycle is exercised in browser tests, not jsdom.
vi.mock("virtual:pwa-register/react", () => ({ useRegisterSW: vi.fn() }));
afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
});
