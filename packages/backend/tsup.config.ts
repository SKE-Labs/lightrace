import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  noExternal: ["@lightrace/shared", "protobufjs", "dotenv"],
});
