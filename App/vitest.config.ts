import { defineConfig } from "vitest/config";
import { BaseSequencer } from "vitest/node";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const appRequire = createRequire(import.meta.url);

const projectRoot = fileURLToPath(
  new URL("../", import.meta.url)
);

// Sort tests alphabetically by their full file path
class AlphabeticalSequencer extends BaseSequencer {
  override async sort(files: Parameters<BaseSequencer["sort"]>[0]) {
    return [...files].sort((a, b) =>
      a.moduleId.localeCompare(b.moduleId, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }
}

export default defineConfig({
  root: projectRoot,

  resolve: {
    alias: [
      {
        find: /^express$/,
        replacement: appRequire.resolve("express"),
      },
      {
        find: /^supertest$/,
        replacement: appRequire.resolve("supertest"),
      },
    ],
  },

  test: {
    include: ["Testy/**/*.test.ts"],
    environment: "node",
    clearMocks: true,

    // Run files sequentially in the sorted order
    fileParallelism: false,

    sequence: {
      sequencer: AlphabeticalSequencer,
    },
  },
});