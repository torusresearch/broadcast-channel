import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/configs/browserSetup.ts"],
    reporters: "verbose",
    browser: {
      screenshotFailures: false,
      headless: true,
      provider: "playwright",
      enabled: true,
      instances: [
        { name: "Chrome", browser: "chromium" },
        { name: "Firefox", browser: "firefox" },
        { name: "Safari", browser: "webkit" },
      ],
    },
    coverage: {
      reporter: ["text"],
      provider: "istanbul",
      include: ["src/**/*.ts"],
    },
    include: [
      // integration tests
      "test/integration.test.ts",

      // issues tests
      "test/issues.test.ts",

      // unit tests
      "test/unit/indexed-db.method.test.ts",
      "test/unit/localstorage.method.test.ts",
      "test/unit/native.method.test.ts",
    ],
  },
});
