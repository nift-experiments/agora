// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These are app-bundle namespaces; the loader contract can be checked without
// importing the docs shell or compiling the corpus.
vi.mock('@/components/mdx', () => ({ Parameter: () => null }));
vi.mock('@/components/mdx/PlanCards', () => ({ PlanCards: () => null }));
vi.mock('@/components/mdx/RTCMinutesCalculator', () => ({ RTCMinutesCalculator: () => null }));
vi.mock('@/components/mdx/PlatformTabsGroup', () => ({ PlatformTabsGroup: () => null }));

let root: string;
beforeEach(async () => {
  vi.resetModules();
  root = await mkdtemp(join(tmpdir(), 'agora-loader-'));
  await mkdir(join(root, '__nift/content'), { recursive: true });
  vi.stubEnv('NIFT_CONTENT_ROOT', root);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

async function manifest(value: unknown) {
  await writeFile(join(root, '__nift/content-manifest.json'), JSON.stringify(value));
}

describe('Nift content loader', () => {
  it('loads the manifest and same ESM component from the SSR publication root', async () => {
    await manifest({ 'en/proof.mdx': '/__nift/content/proof.mjs' });
    await writeFile(
      join(root, '__nift/content/proof.mjs'),
      'export default function Proof() { return null; } export const marker = "proof";',
    );
    const loader = await import('./nift-content-loader');
    const module = await loader.preloadDocsContent('en/proof.mdx');
    expect(module.default.name).toBe('Proof');
    const runtime = (globalThis as any).__NIFT_RUNTIME;
    expect(typeof runtime.react.createElement).toBe('function');
    expect(typeof runtime.jsx.jsx).toBe('function');
    expect(typeof runtime.planCards.PlanCards).toBe('function');
  });

  it.each([
    [],
    { 'en/proof.mdx': 'https://example.com/proof.mjs' },
    { 'en/proof.mdx': '/__nift/../outside.mjs' },
    { 'en/proof.mdx': '/__nift/content/proof.mjs?revision=1' },
    { 'en/proof.mdx': '/__nift/content\\proof.mjs' },
  ])('rejects malformed or unconfined manifests: %j', async (value) => {
    await manifest(value);
    const loader = await import('./nift-content-loader');
    await expect(loader.preloadDocsContent('en/proof.mdx')).rejects.toThrow('Invalid Nift content');
  });

  it('fails explicitly for absent source paths instead of substituting content', async () => {
    await manifest({});
    const loader = await import('./nift-content-loader');
    await expect(loader.preloadDocsContent('en/missing.mdx')).rejects.toThrow('does not exist');
  });
});
