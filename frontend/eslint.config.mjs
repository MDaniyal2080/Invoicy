import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Project overrides
    rules: {
      // Reduce strictness temporarily to unblock development; we will tighten later
      "@typescript-eslint/no-explicit-any": "warn",
      // Prefer ts-expect-error, but don't fail the build while migrating
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        { "ts-ignore": true }
      ],
      // Disable for JSX text to avoid excessive escaping inside copy
      "react/no-unescaped-entities": "off",
      // Style preference: warn instead of error
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
