import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  dts: true,
  // Bundle workspace packages? No, usually shared logic should be bundled but deps kept external generally?
  // But wait, the user's example says:
  /*
  export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true
});
  */
  // It doesn't specify noExternal for shared.
  // I'll add dts: true just in case because standard libs need d.ts
});
