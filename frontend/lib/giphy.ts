// Lazy Giphy client. The SDK previously loaded via module-scope imports in
// three components, which pulled it into the artist-page and feed bundles
// even though it's only needed once a user opens the GIF picker.
import type { GiphyFetch } from '@giphy/js-fetch-api'

const GIPHY_KEY = 'IWgtAtuxJnea1tRbdy4nVnEjW96RrWSj'

let gfPromise: Promise<GiphyFetch> | null = null

export function getGiphy(): Promise<GiphyFetch> {
  if (!gfPromise) {
    gfPromise = import('@giphy/js-fetch-api').then(m => new m.GiphyFetch(GIPHY_KEY))
  }
  return gfPromise
}
