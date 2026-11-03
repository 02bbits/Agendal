import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // IM-05: read the time through src/lib/clock.ts so tests can pin it
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/clock.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Use now() from @/lib/clock.",
        },
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: "Use now() from @/lib/clock.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
