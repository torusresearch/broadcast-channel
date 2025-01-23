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
            include: ["src/**/*.js"],
        },
        include: [
            // integration tests
            "test/integration.test.js",

            // issues tests
            "test/issues.test.js",

            // unit tests
            "test/unit/indexed-db.method.test.js",
            "test/unit/localstorage.method.test.js",
            "test/unit/native.method.test.js",
        ],
    },
});
