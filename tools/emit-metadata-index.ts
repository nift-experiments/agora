/** Derived, server-only per-document metadata. The full catalog remains the projection contract. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
async function writeChanged(file: string, value: string) {
  if (await fs.readFile(file, 'utf8').catch(() => null) === value) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temporary, value); await fs.rename(temporary, file);
}
export async function emitMetadataIndex(publicRoot: string, metadata: Record<string, any>) {
  const directory = path.join(publicRoot, 'metadata');
  await fs.mkdir(directory, { recursive: true });
  const index: Record<string, { frontmatter: any; metadataUrl: string }> = {};
  const maintained = new Set<string>();
  // Bound filesystem operations; do not launch thousands of simultaneous writes.
  const entries = Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b));
  for (let at = 0; at < entries.length; at += 32) {
    await Promise.all(entries.slice(at, at + 32).map(async ([key, value]) => {
      const filename = `${createHash('sha256').update(key).digest('hex')}.json`;
      maintained.add(filename);
      index[key] = { frontmatter: value.frontmatter, metadataUrl: `/__nift/metadata/${filename}` };
      await writeChanged(path.join(directory, filename), JSON.stringify(value) + '\n');
    }));
  }
  for (const file of await fs.readdir(directory)) if (file.endsWith('.json') && !maintained.has(file)) await fs.unlink(path.join(directory, file));
  await writeChanged(path.join(publicRoot, 'content-heads.json'), JSON.stringify(Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)))) + '\n');
}

/** Check derived-file completeness without loading article bodies. */
export async function metadataIndexReady(publicRoot: string): Promise<boolean> {
  try {
    const index = JSON.parse(await fs.readFile(path.join(publicRoot, 'content-heads.json'), 'utf8'));
    if (!index || typeof index !== 'object' || Array.isArray(index)) return false;
    const manifest = JSON.parse(await fs.readFile(path.join(publicRoot, 'content-manifest.json'), 'utf8'));
    const keys=Object.keys(manifest);
    if(keys.length!==Object.keys(index).length || keys.some(key=>!Object.hasOwn(index,key)))return false;
    const filenames = new Set((await fs.readdir(path.join(publicRoot, 'metadata'), {withFileTypes:true})).filter(entry=>entry.isFile()).map(entry=>entry.name));
    for (const [key, head] of Object.entries(index) as [string, any][]) {
      const filename = `${createHash('sha256').update(key).digest('hex')}.json`;
      if (head?.metadataUrl !== `/__nift/metadata/${filename}` || !filenames.has(filename)) return false;
    }
    return true;
  } catch { return false; }
}
