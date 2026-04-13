
/**
 * Must match `Route path={\`/${path}\`}` keys in `pages.config.js` (PascalCase).
 * Lowercase URLs (e.g. `/statistics`) do not match `/Statistics` in React Router v6.
 */
export function createPageUrl(pageName: string) {
  return `/${String(pageName).replace(/\s+/g, "")}`;
}