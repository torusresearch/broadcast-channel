import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: "verbose",
    include: [
      // simple tests
      "test/simple.test.ts",
    ],
  },
});
