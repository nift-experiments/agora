/** Body-only payload updates; unsupported dependency changes use the full source generator. */
import { plugin } from 'bun';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';

const project = resolve(import.meta.dir, '..');
const app = join(project, 'app');
process.chdir(app);
plugin({
  name: 'nift-payload-raw-assets',
  setup(builder) {
    builder.onResolve({ filter: /\?raw$/ }, args => ({ path: resolve(dirname(args.importer), args.path.slice(0, -4)), namespace: 'nift-raw' }));
    builder.onLoad({ filter: /.*/, namespace: 'nift-raw' }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, 'utf8'))};`, loader: 'js' }));
  },
});
const statePath = join(project, '.generated/payload-update-state.json');
const fragmentsPath = join(project, '.generated/payload-llm-fragments.json');
const publicRoot = join(app, 'public');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
// Dependency guards need only frontmatter; body projections belong to the
// lazy source adapter, not a second eagerly retained full catalog.
const metadata = await readJson(join(publicRoot, '__nift/content-heads.json')).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return readJson(join(publicRoot, '__nift/content-metadata.json'));
});
const manifest = await readJson(join(publicRoot, '__nift/content-manifest.json'));

async function walk(dir: string): Promise<string[]> {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))).flat().sort();
}
// Body sources are deliberately absent; every other source affecting payload
// semantics is guarded. A navigation/config/component/OpenAPI edit falls back.
async function structuralSignature() {
  const paths = [
    ...(await walk(join(app, 'src/lib'))).filter(path => !/\.(test|spec)\.[^.]+$/.test(path) && !/\.(browser|client)\./.test(path)),
    ...(await walk(join(app, 'content/openapi'))),
    ...(await walk(join(app, 'content/docs'))).filter(p => /meta\.(json|yaml)$/.test(p)),
    join(app, 'source.config.ts'), join(app, 'bun.lock'), join(app, 'package.json'),
    join(app, 'scripts/generate-static-docs-payload.worker.mjs'),
  ];
  const h = createHash('sha256');
  for (const path of paths.sort()) { h.update(path.slice(app.length)); h.update(await readFile(path)); }
  h.update(JSON.stringify({ region: process.env.VITE_DOCS_REGION ?? 'global', site: process.env.SITE_URL ?? 'https://docs.agora.io' }));
  return h.digest('hex');
}
const signature = await structuralSignature();
async function seed() {
  // Only call after a successful full payload generation: fragments and public
  // outputs belong to the same compiled metadata snapshot.
  const fragments = await readJson(fragmentsPath);
  if (JSON.stringify(fragments.manifest) !== JSON.stringify(manifest)) {
    throw new Error('Cannot seed payload cache: fragments do not match the current compiled manifest');
  }
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ signature, manifest, frontmatter: Object.fromEntries(Object.entries(metadata).map(([p, v]: [string, any]) => [p, v.frontmatter])) }));
}
if (process.argv.includes('--seed')) { await seed(); console.log('[payload-update] seeded derived dependency state'); process.exit(0); }
const loadWorker = () => import('../app/scripts/generate-static-docs-payload.worker.mjs');
async function fallback(reason: string) {
  console.log(`[payload-update] full fallback: ${reason}`);
  const worker = await loadWorker();
  await worker.generateStaticDocsPayload();
  await seed();
}
const previous = await readJson(statePath).catch(() => null);
if (!previous || previous.signature !== signature) { await fallback('missing cache or structural source change'); process.exit(0); }
const keys = Object.keys(metadata).sort();
if (JSON.stringify(keys) !== JSON.stringify(Object.keys(previous.frontmatter).sort()) || keys.some(p => JSON.stringify(metadata[p].frontmatter) !== JSON.stringify(previous.frontmatter[p]))) {
  await fallback('source inventory/frontmatter change'); process.exit(0);
}
const changed = keys.filter(p => manifest[p] !== previous.manifest[p]);
if (!changed.length) { console.log('[payload-update] no changed compiled modules'); process.exit(0); }
const worker = await loadWorker();
const { source } = await import('../app/src/lib/source.server');
const { loadDocsPagePayload } = await import('../app/src/lib/docs-page.server');
const { resolvePlatformGroupParentPage } = await import('../app/src/lib/platforms/platform-group-pages');
const { getSearchEntryMetadata } = await import('../app/src/lib/docs-search');
const { withAgentDocsDirective } = await import('../app/src/lib/agent-docs-directive');
const { PUBLISHED_DOCS_LOCALES } = await import('../app/src/lib/site-region');
const { MACHINE_READABLE_LOCALE, getMachineReadableEntryRoute } = await import('../app/src/lib/machine-readable-docs');
const fragments = await readJson(fragmentsPath).catch(() => null);
if (!fragments) { await fallback('missing LLM fragment cache'); process.exit(0); }
const affected = new Map<string, any>();
for (const locale of ['en', 'zh-CN']) {
  const pages = source.getPages(locale);
  for (const page of pages) {
    if (!changed.includes(page.path)) continue;
    const parent = resolvePlatformGroupParentPage(page, pages);
    const canonical = parent ?? page;
    affected.set(canonical.path, canonical);
  }
}
const pendingPayloads: { route: any; payload: any }[] = [];
// Check platform/route descriptors before any publication writes. A body edit
// can introduce platform routes despite unchanged frontmatter.
for (const page of affected.values()) {
  const route = worker.parseRoute(page.url);
  if (!route || !PUBLISHED_DOCS_LOCALES.includes(route.locale)) continue;
  const file = join(publicRoot, '__static/docs', route.locale, route.tab, route.slugSegments.length ? `${route.slugSegments.join('/')}.json` : 'index.json');
  const old = await readJson(file).catch(() => null);
  const payload = await loadDocsPagePayload(route.locale, route.tab, route.slugSegments);
  if (!old || !payload || 'redirectUrl' in old || 'redirectUrl' in payload || JSON.stringify(old.body) !== JSON.stringify(payload.body)) {
    await fallback('changed platform/body routing descriptor'); process.exit(0);
  }
  pendingPayloads.push({ route, payload });
}
for (const { route, payload } of pendingPayloads) await worker.writePayload(join(publicRoot, '__static/docs'), { ...route, payload });
for (const page of affected.values()) {
  if (!page.url.startsWith(`/${MACHINE_READABLE_LOCALE}/`)) continue;
  const text = await worker.getStaticLLMText(page);
  const index = fragments.pages.findIndex((fragment: any) => fragment.path === page.path);
  if (index < 0) { await fallback('unmatched canonical LLM fragment'); process.exit(0); }
  fragments.pages[index].text = text;
  await worker.writePublicRouteFile(`${page.url}.md`, withAgentDocsDirective(text));
  await worker.writePlatformMarkdownFiles(page, await worker.getStaticPagePlatformKeys(page));
  const entry = getMachineReadableEntryRoute();
  if (entry?.sourcePath === page.url) await worker.writePublicRouteFile(entry.markdownPath, withAgentDocsDirective(text));
}
// Raw-text search is upstream's contract. Existing breadcrumb placement and
// ordering remain valid under the structural/frontmatter guards above.
for (const locale of PUBLISHED_DOCS_LOCALES) {
  const searchPath = join(publicRoot, '__static/docs-search', `${locale}.json`);
  const rows = await readJson(searchPath);
  const pages = new Map(source.getPages(locale).map(page => [page.url, page]));
  let dirty = false;
  for (let i = 0; i < rows.length; i++) {
    const page = pages.get(rows[i].url);
    if (!page || !changed.includes(page.path)) continue;
    const content = await page.data.getText('raw').catch(() => '');
    rows[i] = {
      breadcrumbs: rows[i].breadcrumbs,
      content,
      description: page.data.description,
      ...getSearchEntryMetadata(page.url, content),
      title: page.data.title ?? page.slugs.at(-1) ?? page.url,
      url: page.url,
    };
    dirty = true;
  }
  if (dirty) await writeFile(searchPath, `${JSON.stringify(rows)}\n`);
}
const full = [...fragments.pages.map((fragment: any) => fragment.text), ...fragments.openApi].join('\n\n');
await writeFile(join(publicRoot, 'llms-full.txt'), full.endsWith('\n') ? full : `${full}\n`);
fragments.manifest = manifest;
await writeFile(fragmentsPath, JSON.stringify(fragments));
await seed();
console.log(`[payload-update] ${changed.length} compiled sources, ${pendingPayloads.length} canonical payloads; exact derived search/Markdown/LLM updates`);
