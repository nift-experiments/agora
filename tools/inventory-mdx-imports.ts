/** Inspect actual MDX ESM imports, excluding fenced examples. No compilation or writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app');
const load = (s: string) => import(Bun.resolveSync(s, app));
const { unified } = await load('unified');
const { default: parse } = await load('remark-parse');
const { default: mdx } = await load('remark-mdx');
const parser = unified().use(parse).use(mdx);
const imports: Record<string, string[]> = {}; let pages = 0;
async function visit(dir: string) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name); if (item.isDirectory()) { await visit(file); continue; }
    if (!/\.mdx?$/.test(file)) continue;
    pages++;
    if (!file.endsWith('.mdx')) continue; // Upstream compiles .md in Markdown format, without ESM parsing.
    for (const node of parser.parse(await fs.readFile(file, 'utf8')).children as any[]) {
      if (node.type !== 'mdxjsEsm') continue;
      for (const declaration of node.data?.estree?.body ?? []) if (declaration.source) {
        (imports[declaration.source.value] ??= []).push(path.relative(path.join(app, 'content/docs'), file));
      }
    }
  }
}
await visit(path.join(app, 'content/docs'));
console.log(JSON.stringify({ pages, imports }, null, 2));
