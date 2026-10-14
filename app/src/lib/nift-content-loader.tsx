import { createClientLoader } from 'fumadocs-mdx/runtime/browser';
import type { MDXComponents } from 'mdx/types';
import * as React from 'react';
import * as JSXRuntime from 'react/jsx-runtime';
import * as MDXRuntime from '@/components/mdx';
import * as PlanCardsRuntime from '@/components/mdx/PlanCards';
import * as CalculatorRuntime from '@/components/mdx/RTCMinutesCalculator';
import * as PlatformTabsRuntime from '@/components/mdx/PlatformTabsGroup';

type ContentProps = { components?: MDXComponents };
type ContentModule = { default: React.ComponentType<ContentProps> };
type ContentManifest = Record<string, string>;

// Browser ESM bridges reuse the application's React and component instances.
const sharedRuntime = globalThis as typeof globalThis & {
  __NIFT_RUNTIME?: {
    react: typeof React;
    jsx: typeof JSXRuntime;
    mdx: typeof MDXRuntime;
    planCards: typeof PlanCardsRuntime;
    rtcCalculator: typeof CalculatorRuntime;
    platformTabs: typeof PlatformTabsRuntime;
  };
};
sharedRuntime.__NIFT_RUNTIME = {
  react: React,
  jsx: JSXRuntime,
  mdx: MDXRuntime,
  planCards: PlanCardsRuntime,
  rtcCalculator: CalculatorRuntime,
  platformTabs: PlatformTabsRuntime,
};

const MANIFEST_URL = '/__nift/content-manifest.json';

function validateManifest(value: unknown): ContentManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Nift content manifest: expected a path map');
  }
  for (const [contentPath, moduleUrl] of Object.entries(value)) {
    if (
      !contentPath ||
      typeof moduleUrl !== 'string' ||
      !moduleUrl.startsWith('/__nift/') ||
      moduleUrl.includes('\\') ||
      /[?#]/.test(moduleUrl) ||
      moduleUrl.split('/').some((part) => part === '..' || part === '.')
    ) {
      throw new Error(`Invalid Nift content module path for ${contentPath}`);
    }
  }
  return value as ContentManifest;
}

async function loadManifest(): Promise<ContentManifest> {
  if (import.meta.env.SSR) {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const root = process.env.NIFT_CONTENT_ROOT ?? resolve(process.cwd(), 'public');
    return validateManifest(
      JSON.parse(await readFile(resolve(root, MANIFEST_URL.slice(1)), 'utf8')),
    );
  }
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Unable to load Nift content manifest: ${response.status}`);
  }
  return validateManifest(await response.json());
}

async function loadModule(moduleUrl: string): Promise<ContentModule> {
  let importUrl = moduleUrl;
  if (import.meta.env.SSR) {
    const { resolve } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const root = process.env.NIFT_CONTENT_ROOT ?? resolve(process.cwd(), 'public');
    importUrl = pathToFileURL(resolve(root, moduleUrl.slice(1))).href;
  }
  const loaded = (await import(/* @vite-ignore */ importUrl)) as ContentModule;
  if (typeof loaded.default !== 'function') {
    throw new Error(`Nift content module has no component: ${moduleUrl}`);
  }
  return loaded;
}

async function createDocsLoader() {
  const manifest = await loadManifest();
  const modules: Record<string, () => Promise<ContentModule>> = {};
  for (const [contentPath, moduleUrl] of Object.entries(manifest)) {
    modules[contentPath] = () => loadModule(moduleUrl);
  }
  return createClientLoader<ContentModule, ContentProps | undefined>(modules, {
    id: 'nift-docs-content',
    component: (doc, props) => {
      const Content = doc.default;
      return <Content components={props?.components} />;
    },
  });
}

let loaderPromise: ReturnType<typeof createDocsLoader> | undefined;
function getDocsLoader() {
  return (loaderPromise ??= createDocsLoader());
}

export async function preloadDocsContent(path: string) {
  return (await getDocsLoader()).preload(path);
}

export function useDocsContent(path: string, props?: ContentProps) {
  return React.use(getDocsLoader()).useContent(path, props);
}
