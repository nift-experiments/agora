import { readFile, mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
const root = resolve(import.meta.dir, '..');
async function writeChanged(path: string, bytes: string) {
  if (await readFile(path, 'utf8').catch(() => null) === bytes) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
const tracked: any[] = [];
async function visit(dir: string) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.name.endsWith('.html')) {
      const name = relative(join(root, '.generated/html'), path).replace(/\.html$/, '');
      const input = `.generated/html/${name}.html`;
      tracked.push({ name, title: name, template: '', build: 'tools/compose.f' });
      await mkdir(dirname(join(root, 'public', name + '.html')), { recursive: true });
      await writeChanged(join(root, 'content/generated', name + '.html'), JSON.stringify({ input }) + '\n');
      await writeChanged(join(root, 'content/generated', name + '.deps.json'), JSON.stringify({ dependencies: [input] }) + '\n');
    }
  }
}
await visit(join(root, '.generated/html'));
await writeChanged(join(root, '.nift/tracked.json'), JSON.stringify({ tracked: tracked.sort((a,b) => a.name.localeCompare(b.name)) }, null, 2) + '\n');
console.log(`Registered ${tracked.length} Nift HTML outputs`);
