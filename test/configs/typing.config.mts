import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        reporters: "verbose",
        include: [
            // typings tests
            "test/typings.test.js",
        ],
    },
});
