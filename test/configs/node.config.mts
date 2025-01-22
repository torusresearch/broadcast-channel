import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        reporters: "verbose",
        coverage: {
            reporter: ["text"],
            provider: "istanbul",
            include: ["src/**/*.ts"],
        },
        include: [
            // integration tests
            "test/integration.test.js",

            // issues tests
            "test/issues.test.js",

            // unit tests
            "test/unit/custom.method.test.js",
        ],
        environment: "node",
    },
});
