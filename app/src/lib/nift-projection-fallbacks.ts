// Pinned AgoraIO/docs-portal 3c6552914e6cec74ab5d9c38b3bd4eeb51871d13:
// the dynamic payload compiler cannot resolve these authored MDX imports,
// whereas the browser/Vite article compiler does. Preserve its raw-text
// machine-readable fallback without disabling the working React article.
export const PINNED_DYNAMIC_PROJECTION_FALLBACKS = new Set([
  'en/ai/best-practices/regional-restrictions.mdx',
  'zh-CN/realtime-media/rtm/index.mdx',
  'zh-CN/realtime-media/rtm/reference/billing/billing-strategy.mdx',
]);
