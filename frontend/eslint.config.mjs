import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // React-compiler-era rules, downgraded to warnings: the codebase
      // predates them and carries ~25 deliberate instances of these patterns
      // (prop-driven animation lifecycles, ref-measured layouts, seeded
      // randomness). CI fails on errors only — new code should still avoid
      // these (visible as warnings), and true crash bugs like
      // rules-of-hooks stay errors. Tightening back to errors is welcome
      // once the existing sites are refactored.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      // 4 pre-existing `any`s in fetch-shaped code; style debt, not a crash.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
