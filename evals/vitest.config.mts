import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Evals call the real Gemini (and Sarvam for voice), so they are kept out of `npm test`
 * and started by hand: see evals/README.md.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./shared/empty.ts", import.meta.url)),
    },
  },
  test: {
    root: fileURLToPath(new URL("..", import.meta.url)),
    include: ["evals/**/*.eval.ts"],
    testTimeout: 60 * 60 * 1000,
    hookTimeout: 60 * 1000,
  },
});
