/** Independent, cached Fumadocs compilation; never bundles the app into a document. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app');
const docs = path.join(app, 'content/docs');
const cacheDir = path.join(root, '.generated/content-compiler');
const publicRoot = path.join(app, 'public/__nift');
const modulesDir = path.join(publicRoot, 'content');
const args = process.argv.slice(2);
const only = args.indexOf('--only');
const requested = only < 0 ? null : args.slice(only + 1).flatMap((s) => s.split(','));
const force = args.includes('--force');
const planOnly = args.includes('--plan');
const finalizeOnly = args.includes('--finalize');
process.chdir(app);
const fromApp = async (specifier: string) => import(Bun.resolveSync(specifier, app));
const { createMdxPlugin } = await fromApp('fumadocs-mdx/bun');
const { unified } = await fromApp('unified');
const { default: remarkParse } = await fromApp('remark-parse');
const { default: remarkMdx } = await fromApp('remark-mdx');
const { default: remarkDirective } = await fromApp('remark-directive');
const { parse: parseJs } = await fromApp('acorn');
const jsxRuntime = await fromApp('react/jsx-runtime');
const parser = unified().use(remarkParse).use(remarkMdx).use(remarkDirective);
const markdownParser = unified().use(remarkParse).use(remarkDirective);
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const slash = (s: string) => s.split(path.sep).join('/');
async function exists(p: string) { return fs.access(p).then(() => true, () => false); }
async function json(p: string, fallback: any) { return fs.readFile(p, 'utf8').then(JSON.parse).catch(() => fallback); }
async function writeChanged(p: string, value: string) {
  if (await fs.readFile(p, 'utf8').catch(() => null) === value) return;
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`; await fs.writeFile(tmp, value); await fs.rename(tmp, p);
}
async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [path.join(dir, e.name)] : []))).flat().sort();
}
function sourceInfo(file: string, source: string): { imports: string[]; includes: string[]; assets: string[] } {
  const tree = (file.endsWith('.mdx') ? parser : markdownParser).parse(source);
  const imports = tree.children.filter((n: any) => n.type === 'mdxjsEsm').flatMap((n: any) =>
    (n.data?.estree?.body ?? []).filter((s: any) => s.source).map((s: any) => s.source.value));
  const includes: string[] = [];
  const assets: string[] = [];
  const flatten = (n: any): string => n.children ? n.children.map(flatten).join('') : n.value ?? '';
  function visit(n: any) {
    if (n.type === 'image' && !/^https?:\/\//.test(n.url)) {
      const url = decodeURI(n.url);
      assets.push(url.startsWith('file:///') ? fileURLToPath(url) : url.startsWith('/') ? path.join(app, 'public', url) : path.join(path.dirname(file), url));
    }
    if (n.name === 'include') {
      const spec = flatten(n); const cwd = Array.isArray(n.attributes) ? n.attributes.some((a: any) => a.name === 'cwd') : Object.hasOwn(n.attributes ?? {}, 'cwd');
      const relative = spec.includes('#') ? spec.slice(0, spec.lastIndexOf('#')) : spec;
      if (relative) includes.push(path.resolve(cwd ? app : path.dirname(file), relative));
    }
    for (const child of n.children ?? []) visit(child);
  }
  visit(tree); return { imports, includes, assets };
}
async function localFile(spec: string, owner: string): Promise<string | null> {
  const base = spec.startsWith('@/') ? path.join(app, 'src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(owner), spec) : null;
  if (!base) return null;
  for (const p of [base, ...['.ts', '.tsx', '.js', '.mjs', '.mdx', '.md', '/index.ts', '/index.tsx'].map((e) => base + e)]) {
    if (await fs.stat(p).then((s) => s.isFile()).catch(() => false)) return p;
  }
  throw new Error(`Unresolved local import ${spec} in ${owner}`);
}
// Configuration plugins invalidate compiled content; app components belong to the separately built runtime.
const configDependencies = new Map<string, string>();
async function configGraph(file: string) {
  if (configDependencies.has(file)) return;
  const source = await fs.readFile(file, 'utf8'); configDependencies.set(file, hash(source));
  const imports = new Bun.Transpiler({ loader: file.endsWith('.tsx') ? 'tsx' : 'ts' }).scan(source).imports;
  for (const item of imports) { const local = await localFile(item.path, file); if (local) await configGraph(local); }
}
await configGraph(path.join(app, 'source.config.ts'));
const configHash = hash(JSON.stringify([...configDependencies].map(([p, h]) => [slash(path.relative(app, p)), h]).sort()) + await fs.readFile(path.join(app, 'bun.lock'), 'utf8') + await fs.readFile(fileURLToPath(import.meta.url), 'utf8'));
await fs.mkdir(modulesDir, { recursive: true }); await fs.mkdir(cacheDir, { recursive: true });
const statePath = path.join(cacheDir, 'state.json');
const state = await json(statePath, { version: 1, documents: {} });
state.includeRecords ??= {};
const manifest = await json(path.join(publicRoot, 'content-manifest.json'), {});
const metadata = await json(path.join(cacheDir, 'metadata.json'), {});
const paths = requested ? requested.filter((s) => !s.startsWith('--')).map((s) => path.resolve(docs, s.replace(/^content\/docs\//, ''))) : await walk(docs);
const encode = (v: any) => JSON.stringify(Object.fromEntries(Object.entries(v).sort()), null, 2) + '\n';
if (finalizeOnly) {
  if (requested) throw new Error('--finalize requires a complete source inventory');
  const current = new Set(paths.map((file) => slash(path.relative(docs, file))));
  const deleted = new Set([...Object.keys(state.documents), ...Object.keys(manifest), ...Object.keys(metadata)].filter((key) => !current.has(key)));
  for (const key of deleted) { delete state.documents[key]; delete state.analysisRecords?.[key]; delete manifest[key]; delete metadata[key]; }
  await writeChanged(path.join(publicRoot, 'content-manifest.json'), encode(manifest));
  await writeChanged(path.join(cacheDir, 'metadata.json'), encode(metadata));
  await writeChanged(path.join(publicRoot, 'content-metadata.json'), encode(metadata));
  await writeChanged(statePath, JSON.stringify(state, null, 2) + '\n');
  console.log(JSON.stringify({ finalized: true, selected: current.size, deleted: [...deleted].sort() }));
  process.exit(0);
}
const selected = new Map<string, { source: string; imports: string[]; includes: string[]; assets: string[]; dependencies: string[]; fingerprint?: string }>();
const includeHashes = new Map<string, string>();
const assetHashes = new Map<string, string>();
async function assetHash(file: string) {
  if (!file.startsWith(app + path.sep)) throw new Error(`Local image outside maintained app: ${file}`);
  if (!assetHashes.has(file)) assetHashes.set(file, await fs.readFile(file).then(hash).catch((error) => { if (error.code === 'ENOENT') return 'missing'; throw error; }));
  return assetHashes.get(file)!;
}
async function includeHash(file: string, stack: string[] = []): Promise<string> {
  if (stack.includes(file)) throw new Error(`Cyclic include: ${[...stack, file].join(' -> ')}`);
  if (includeHashes.has(file)) return includeHashes.get(file)!;
  if (!file.startsWith(app + path.sep)) throw new Error(`Include outside maintained app: ${file}`);
  const source = await fs.readFile(file, 'utf8'); const sourceHash = hash(source); const key = slash(path.relative(app, file));
  const old = state.includeRecords[key];
  const info = old?.sourceHash === sourceHash && old.assets ? old : /\.mdx?$/.test(file) ? sourceInfo(file, source) : { includes: [], assets: [] };
  const { includes, assets } = info;
  state.includeRecords[key] = { sourceHash, includes, assets };
  const value = hash(sourceHash + (await Promise.all(includes.map((p: string) => includeHash(p, [...stack, file])))).join('') + (await Promise.all(assets.map(assetHash))).join(''));
  includeHashes.set(file, value); return value;
}
async function select(file: string) {
  if (selected.has(file)) return;
  if (!file.startsWith(docs + path.sep)) throw new Error(`Content source outside maintained docs: ${file}`);
  const source = await fs.readFile(file, 'utf8');
  const key = slash(path.relative(docs, file));
  const previous = state.documents[key];
  const old = previous?.sourceHash === hash(source) ? previous : state.analysisRecords?.[key];
  const info = old?.sourceHash === hash(source) && old.includes && old.assets ? old : sourceInfo(file, source);
  const { imports, includes, assets } = info;
  const item = { source, imports, includes, assets, dependencies: [] as string[], fingerprint: '' }; selected.set(file, item);
  for (const include of includes) await includeHash(include);
  for (const asset of assets) await assetHash(asset);
  for (const spec of imports) {
    const dependency = await localFile(spec, file);
    if (dependency && /\.mdx?$/.test(dependency)) { item.dependencies.push(dependency); await select(dependency); }
  }
}
for (const file of paths) await select(file);
function fingerprint(file: string, stack: string[] = []): string {
  if (stack.includes(file)) throw new Error(`Cyclic MDX imports: ${[...stack, file].join(' -> ')}`);
  const item = selected.get(file)!;
  return item.fingerprint ||= hash(configHash + item.source + item.includes.map((d) => includeHashes.get(d)).join('') + item.assets.map((d) => assetHashes.get(d)).join('') + item.dependencies.map((d) => fingerprint(d, [...stack, file])).join(''));
}
const dirty = [...selected].filter(([file]) => {
  const key = slash(path.relative(docs, file)); const old = state.documents[key];
  return force || old?.fingerprint !== fingerprint(file) || !old?.module || manifest[key] !== old.module || !metadata[key];
}).map(([file]) => file);
// Missing generated modules must also be regenerated after a clean application-state reset.
for (const file of selected.keys()) {
  const old = state.documents[slash(path.relative(docs, file))];
  if (old?.module && !await exists(path.join(app, 'public', old.module)) && !dirty.includes(file)) dirty.push(file);
}
if (planOnly) {
  // Preserve dependency analysis, never a compiled fingerprint, so workers do not parse a fresh corpus twice.
  state.analysisRecords ??= {};
  for (const [file, item] of selected) state.analysisRecords[slash(path.relative(docs, file))] = { sourceHash: hash(item.source), imports: item.imports, includes: item.includes, assets: item.assets };
  await writeChanged(statePath, JSON.stringify(state, null, 2) + '\n');
  const current = new Set([...selected.keys()].map((file) => slash(path.relative(docs, file))));
  console.log(JSON.stringify({ selected: selected.size, dirty: dirty.map((file) => slash(path.relative(docs, file))), cached: selected.size - dirty.length, configHash, deleted: requested ? [] : Object.keys(state.documents).filter((key) => !current.has(key)).sort() }));
  process.exit(0);
}
const bridges: Record<string, { name: string; namespace: string }> = {
  react: { name: 'react', namespace: 'react' },
  'react/jsx-runtime': { name: 'jsx', namespace: 'jsx' },
  '@/components/mdx': { name: 'mdx', namespace: 'mdx' },
  '@/components/mdx/PlanCards': { name: 'plan-cards', namespace: 'planCards' },
  '@/components/mdx/RTCMinutesCalculator': { name: 'rtc-calculator', namespace: 'rtcCalculator' },
  '@/components/mdx/PlatformTabsGroup': { name: 'platform-tabs', namespace: 'platformTabs' },
};
const bridgeExports = new Map<string, Set<string>>();
const compiled = new Map<string, string>();
const dirtySet = new Set(dirty);
const metadataNames = new Set(['frontmatter', 'toc', 'structuredData', '_markdown', 'lastModified', 'extractedReferences']);
function literal(node: any, bindings: Record<string, any>): any {
  switch (node.type) {
    case 'Literal': return node.value;
    case 'ArrayExpression': return node.elements.map((n: any) => n ? literal(n, bindings) : null);
    case 'ObjectExpression': return Object.fromEntries(node.properties.map((p: any) => {
      if (p.type !== 'Property' || p.computed || p.kind !== 'init') throw new Error('Nonliteral generated metadata property');
      return [p.key.name ?? p.key.value, literal(p.value, bindings)];
    }));
    case 'TemplateLiteral': if (!node.expressions.length) return node.quasis.map((q: any) => q.value.cooked).join(''); break;
    case 'UnaryExpression': if (node.operator === '-') return -literal(node.argument, bindings); if (node.operator === '+') return +literal(node.argument, bindings); if (node.operator === 'void') return undefined; break;
    case 'Identifier': if (node.name === 'undefined') return undefined; if (Object.hasOwn(bindings, node.name)) return bindings[node.name]; break;
    // Rich TOC titles may contain compiler-generated React fragments/code spans. Instantiate only these whitelisted JSX constructors.
    case 'CallExpression': if (node.callee.type === 'Identifier' && [jsxRuntime.jsx, jsxRuntime.jsxs].includes(bindings[node.callee.name])) return bindings[node.callee.name](...node.arguments.map((n: any) => literal(n, bindings))); break;
  }
  throw new Error(`Unsupported generated metadata expression: ${node.type}`);
}
const pending = new Map<string, string>();
async function emit(file: string): Promise<string> {
  const key = slash(path.relative(docs, file)); if (pending.has(file)) return pending.get(file)!;
  if (!dirtySet.has(file)) return manifest[key];
  const original = compiled.get(file); if (!original) throw new Error(`Compiler produced no source for ${key}`);
  let source = new Bun.Transpiler({ loader: 'jsx', target: 'browser' }).transformSync(original);
  const ast = parseJs(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const imports = ast.body.filter((n: any) => n.source);
  const bindings: Record<string, any> = {};
  for (const declaration of imports as any[]) if (declaration.source.value === 'react/jsx-runtime') for (const specifier of declaration.specifiers) {
    if (specifier.type === 'ImportSpecifier' && ['jsx', 'jsxs', 'Fragment'].includes(specifier.imported.name)) bindings[specifier.local.name] = jsxRuntime[specifier.imported.name];
  }
  const values: any = {};
  for (const node of ast.body as any[]) if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
    for (const declaration of node.declaration.declarations) if (metadataNames.has(declaration.id.name)) values[declaration.id.name] = literal(declaration.init, bindings);
  }
  metadata[key] = values;
  const documentBridges: Record<string, string[]> = {};
  const rewrites: { start: number; end: number; value: string }[] = [];
  for (const declaration of imports as any[]) {
    const spec = declaration.source.value;
    let destination: string;
    const local = await localFile(spec, file);
    if (local && /\.mdx?$/.test(local)) destination = './' + path.basename(await emit(local));
    else {
      const clean = spec.replace(/\.tsx?$/, ''); const bridge = bridges[clean];
      if (!bridge) throw new Error(`No shared-runtime bridge for real MDX import ${spec} in ${key}`);
      destination = `../runtime-${bridge.name}.mjs`;
      const names = bridgeExports.get(clean) ?? new Set<string>();
      for (const binding of declaration.specifiers ?? []) if (binding.type === 'ImportSpecifier') names.add(binding.imported.name ?? binding.imported.value); else if (binding.type === 'ImportDefaultSpecifier') names.add('default'); else if (binding.type === 'ImportNamespaceSpecifier') throw new Error(`Namespace import requires explicit bridge export inventory: ${spec}`);
      bridgeExports.set(clean, names);
      documentBridges[clean] = [...new Set((declaration.specifiers ?? []).map((binding: any) => binding.type === 'ImportSpecifier' ? binding.imported.name ?? binding.imported.value : 'default'))] as string[];
    }
    rewrites.push({ start: declaration.source.start, end: declaration.source.end, value: JSON.stringify(destination) });
  }
  for (const rewrite of rewrites.sort((a, b) => b.start - a.start)) source = source.slice(0, rewrite.start) + rewrite.value + source.slice(rewrite.end);
  const js = source;
  const url = `/__nift/content/${hash(js)}.mjs`; pending.set(file, url);
  await writeChanged(path.join(app, 'public', url), js);
  manifest[key] = url; state.documents[key] = { fingerprint: fingerprint(file), sourceHash: hash(selected.get(file)!.source), module: url, dependencies: selected.get(file)!.dependencies.map((d) => slash(path.relative(docs, d))), includes: selected.get(file)!.includes, assets: selected.get(file)!.assets, imports: selected.get(file)!.imports, bridges: documentBridges };
  return url;
}
const batchSize = Number(process.env.NIFT_CONTENT_BATCH_SIZE ?? 16);
if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('NIFT_CONTENT_BATCH_SIZE must be a positive integer');
let batches = 0;
if (dirty.length) {
  const official = createMdxPlugin({ configPath: path.join(app, 'source.config.ts'), outDir: path.join(cacheDir, 'fumadocs'), disableMetaFile: true });
  const hooks: { options: any; callback: any }[] = [];
  const plugin = { ...official, async setup(build: any) {
    if (hooks.length) { for (const hook of hooks) build.onLoad(hook.options, hook.callback); return; }
    // Reuse one supported plugin/core and its processors/highlighter across bounded Bun builds.
    await official.setup(new Proxy(build, { get(target, key) {
      if (key !== 'onLoad') return Reflect.get(target, key);
      return (options: any, callback: any) => {
        const wrapped = async (args: any) => {
          const result = await callback({ ...args, path: /\.mdx?$/.test(args.path) ? args.path + '?collection=docs' : args.path });
          if (result?.contents && /\.mdx?$/.test(args.path)) compiled.set(args.path, String(result.contents));
          return result;
        };
        hooks.push({ options, callback: wrapped }); target.onLoad(options, wrapped);
      };
    } }));
  } };
  const ordered: string[] = []; const queued = new Set<string>();
  function order(file: string) {
    if (queued.has(file)) return; queued.add(file);
    for (const dependency of selected.get(file)!.dependencies) if (dirtySet.has(dependency)) order(dependency);
    ordered.push(file);
  }
  dirty.forEach(order);
  async function buildBatch(batch: string[]) {
    const result = await Bun.build({ entrypoints: batch, target: 'bun', format: 'esm', external: ['*'], plugins: [plugin], write: false, root: docs, naming: '[dir]/[name].mjs' });
    if (!result.success) throw new AggregateError(result.logs, 'Fumadocs content compilation failed');
  }
  for (let i = 0; i < ordered.length; i += batchSize) {
    const batch = ordered.slice(i, i + batchSize); await buildBatch(batch);
    for (const file of batch) { await emit(file); compiled.delete(file); }
    batches++; Bun.gc(true);
  }
}
for (const document of Object.values(state.documents) as any[]) for (const [spec, names] of Object.entries(document.bridges ?? {}) as [string, string[]][]) {
  const exports = bridgeExports.get(spec) ?? new Set<string>(); for (const name of names) exports.add(name); bridgeExports.set(spec, exports);
}
for (const [spec, exports] of bridgeExports) {
  const bridge = bridges[spec]; const out = path.join(publicRoot, `runtime-${bridge.name}.mjs`);
  const lines = [`const runtime = globalThis.__NIFT_RUNTIME?.${bridge.namespace};`, `if (!runtime) throw new Error('Shared Agora runtime namespace unavailable: ${bridge.namespace}');`];
  for (const name of [...exports].sort()) lines.push(name === 'default' ? 'export default runtime.default ?? runtime;' : `export const ${name} = runtime.${name};`);
  await writeChanged(out, lines.join('\n') + '\n');
}
if (!requested) {
  const current = new Set([...selected.keys()].map((file) => slash(path.relative(docs, file))));
  for (const key of Object.keys(state.documents)) if (!current.has(key)) { delete state.documents[key]; delete manifest[key]; delete metadata[key]; }
}
await writeChanged(path.join(publicRoot, 'content-manifest.json'), encode(manifest));
await writeChanged(path.join(cacheDir, 'metadata.json'), encode(metadata));
await writeChanged(path.join(publicRoot, 'content-metadata.json'), encode(metadata));
await writeChanged(statePath, JSON.stringify(state, null, 2) + '\n');
await writeChanged(path.join(cacheDir, 'last-run.json'), JSON.stringify({ selected: selected.size, compiled: dirty.length, cached: selected.size - dirty.length, batches, batchSize, configHash, configDependencies: [...configDependencies.keys()].map((p) => slash(path.relative(app, p))), runtimeNamespaces: [...bridgeExports.keys()].map((s) => bridges[s].namespace) }, null, 2) + '\n');
console.log(JSON.stringify({ selected: selected.size, compiled: dirty.length, cached: selected.size - dirty.length, manifest: path.join(publicRoot, 'content-manifest.json'), metadata: path.join(cacheDir, 'metadata.json') }));
