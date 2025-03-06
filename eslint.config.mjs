import toruslabsTypescript from "@toruslabs/eslint-config-typescript";
import globals from "globals";

export default [
  ...toruslabsTypescript,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      ecmaVersion: 2018,
      sourceType: "module",
    },

    rules: {
      // import/extensions
      "import/extensions": "off",
      "promise/no-nesting": "off",
      "tsdoc/syntax": "off",
      "no-console": "off",
    },

    // ignore files
    ignores: [
      // ignore eslint for testcafe, since relative plugin is not working
      "test/e2e.test.ts",

      // disable eslint for config files
      "config/**/*.js",

      // dist
      "dist/**/*.js",
    ],
  },
];
