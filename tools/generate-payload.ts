import { plugin } from 'bun';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
// Retain the upstream payload/machine-readable generator. Bun supplies TS
// execution; the only adapter is Vite's maintained raw-spec import contract.
plugin({
  name: 'nift-maintained-raw-assets',
  setup(builder) {
    builder.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(dirname(args.importer), args.path.slice(0, -4)),
      namespace: 'nift-raw',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'nift-raw' }, async (args) => ({
      contents: `export default ${JSON.stringify(await readFile(args.path, 'utf8'))};`,
      loader: 'js',
    }));
  },
});
const { generateStaticDocsPayload } = await import('../app/scripts/generate-static-docs-payload.worker.mjs');
await generateStaticDocsPayload();
