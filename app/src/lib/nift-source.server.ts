import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { server } from 'fumadocs-mdx/runtime/server';
import { parse as parseYaml } from 'yaml';
import { docsMetaSchema } from './docs-meta-schema';
import type * as Config from '../../source.config';
import type { InternalTypeConfig } from 'fumadocs-mdx/runtime/types';
import { PINNED_DYNAMIC_PROJECTION_FALLBACKS } from './nift-projection-fallbacks';

const root = process.env.NIFT_CONTENT_ROOT ?? resolve(process.cwd(), 'public');
const sourceRoot = resolve(process.cwd(), 'content/docs');
// Navigation requires only frontmatter. Full article projections are loaded
// lazily so each bounded SSR worker does not retain the whole text corpus.
let metadata: Record<string, any>;
try {
  metadata = JSON.parse(await readFile(join(root, '__nift/content-heads.json'), 'utf8'));
} catch (error: any) {
  if (error.code !== 'ENOENT') throw error;
  const legacy = JSON.parse(await readFile(join(root, '__nift/content-metadata.json'), 'utf8'));
  metadata = Object.fromEntries(Object.entries(legacy).map(([key, value]: [string, any]) => [key, { frontmatter: value.frontmatter, embedded: value }]));
}
const articleMetadata = new Map<string, Promise<any>>();
function loadMetadata(path: string, entry: any) {
  if (entry.embedded) return Promise.resolve(entry.embedded);
  const url = entry.metadataUrl;
  if (typeof url !== 'string' || !url.startsWith('/__nift/metadata/') || url.includes('..') || url.includes('\\')) throw new Error(`Invalid article metadata URL: ${path}`);
  let pending = articleMetadata.get(path);
  if (!pending) {
    pending = readFile(join(root, url.slice(1)), 'utf8').then(JSON.parse);
    articleMetadata.set(path, pending);
  }
  return pending;
}
const manifest: Record<string, string> = JSON.parse(await readFile(join(root, '__nift/content-manifest.json'), 'utf8'));
const head: Record<string, () => unknown> = {};
const body: Record<string, () => Promise<any>> = {};
const modules = new Map<string, Promise<any>>();
for (const [path, value] of Object.entries(metadata) as [string, any][]) {
  head[path] = () => value.frontmatter;
  // Metadata consumers do not execute or bundle the React article module.
  // Rendering still delegates to the very same independently compiled module.
  body[path] = async () => ({
    ...await loadMetadata(path, value),
    default: function CompiledArticle(props: any) {
      const runtime = (globalThis as any).__NIFT_RUNTIME;
      if (!runtime) throw new Error('Article runtime was not initialized');
      let pending = modules.get(path);
      if (!pending) {
        pending = import(/* @vite-ignore */ pathToFileURL(join(root, manifest[path].slice(1))).href);
        modules.set(path, pending);
      }
      const module = runtime.react.use(pending);
      return runtime.react.createElement(module.default, props);
    },
  });
}
const meta: Record<string, any> = {};
async function collect(dir: string, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await collect(join(dir, entry.name), relative + '/');
    else if (/^meta\.(json|yaml)$/.test(entry.name)) {
      const text = await readFile(join(dir, entry.name), 'utf8');
      meta[relative] = docsMetaSchema.parse(entry.name.endsWith('.json') ? JSON.parse(text) : parseYaml(text));
    }
  }
}
await collect(sourceRoot);
export const docs = await server<typeof Config, InternalTypeConfig>().docsLazy(
  'docs', sourceRoot, meta, head, body,
);
// Fumadocs' public load() contract returns an executable article. Metadata
// getters use the private body map above and remain independent of React
// module execution; only explicit render consumers cross this boundary.
for (const page of docs.docs) {
  const loadMetadata = page.load;
  page.load = async () => {
    // This is a server API even when called by a happy-dom render test.
    // Initialize the shared component runtime without invoking browser fetch.
    await import('./nift-content-loader');
    let pending = modules.get(page.info.path);
    if (!pending) {
      pending = import(/* @vite-ignore */ pathToFileURL(join(root, manifest[page.info.path].slice(1))).href);
      modules.set(page.info.path, pending);
    }
    const module = await pending;
    const loaded = await loadMetadata();
    return { ...loaded, body: module.default as typeof loaded.body };
  };
}
for (const page of docs.docs) {
  if (!PINNED_DYNAMIC_PROJECTION_FALLBACKS.has(page.info.path)) continue;
  const originalGetText = page.getText;
  page.getText = async (kind) => {
    if (kind === 'processed') throw new Error(`Pinned dynamic projection fallback: ${page.info.path}`);
    return originalGetText(kind);
  };
}
