/** Verify bounded AST-extracted metadata against the official emitted module exports. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app');
const load = (name: string) => import(Bun.resolveSync(name, app));
(globalThis as any).__NIFT_RUNTIME = { react: await load('react'), jsx: await load('react/jsx-runtime'), mdx: {}, planCards: {}, rtcCalculator: {}, platformTabs: {} };
const base = path.join(app, 'public/__nift');
const manifest = JSON.parse(await fs.readFile(path.join(base, 'content-manifest.json'), 'utf8'));
const metadata = JSON.parse(await fs.readFile(path.join(base, 'content-metadata.json'), 'utf8'));
for (const page of process.argv.slice(2)) {
  const actual = await import(pathToFileURL(path.join(app, 'public', manifest[page])).href);
  const selected = Object.fromEntries(Object.keys(metadata[page]).map((key) => [key, actual[key]]));
  if (JSON.stringify(selected) !== JSON.stringify(metadata[page])) throw new Error(`Metadata differs: ${page}`);
}
console.log(JSON.stringify({ metadataExportEquivalence: true, pages: process.argv.slice(2).length }));
