export default [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly"
      }
    },
    ignores: ["node_modules/**"],
    rules: {
      "max-lines": ["error", {
        max: 400,
        skipBlankLines: true,
        skipComments: true
      }]
    }
  }
]; 