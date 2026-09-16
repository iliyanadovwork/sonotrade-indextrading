const preloaded = new Set<string>()

/** Warm the browser's HTTP cache for an image URL. Safe to call multiple times. */
export function preloadImage(src: string): void {
  if (!src || preloaded.has(src)) return
  preloaded.add(src)
  const img = new window.Image()
  img.src = src
}
