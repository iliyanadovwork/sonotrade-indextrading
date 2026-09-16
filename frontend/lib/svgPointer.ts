/**
 * Pointer coordinates → SVG user units, correct under CSS `zoom` in every engine.
 *
 * ## The problem
 *
 * `app/globals.css` sets `zoom: 0.90` on `<html>`, and engines disagree about
 * which coordinate space geometry APIs report in:
 *
 * | API                        | Chrome/Blink   | Safari/WebKit |
 * |----------------------------|----------------|---------------|
 * | `MouseEvent.clientX`       | visual (zoomed)| visual (zoomed)|
 * | `getBoundingClientRect()`  | visual (zoomed)| **layout (unzoomed)** |
 * | `getScreenCTM()`           | includes zoom  | **excludes zoom** |
 * | `element.clientWidth`      | layout         | layout         |
 *
 * Measured in Safari 26.2 at `zoom: 0.9`: `rect.width` 716.27 vs
 * `clientWidth` 717 — identical, where Chrome would report a 0.9 ratio.
 *
 * So the old idiom
 *
 * ```ts
 * const scaleX = svg.clientWidth / rect.width      // 1/0.9 in Chrome, 1.0 in Safari
 * const x      = (clientX - rect.left) * scaleX
 * ```
 *
 * is right in Chrome and wrong in Safari, where it subtracts a *layout*
 * `rect.left` from a *visual* `clientX`. The result resolves to `0.9 * clientX`,
 * so a chart crosshair trails the cursor by `0.1 * clientX` — a gap that grows
 * with distance from the left edge. `getScreenCTM()` does not help: it drops the
 * zoom in Safari too, producing the same wrong number.
 *
 * ## The approach
 *
 * Reconstruct the element's *visual* left edge, then divide by the zoom:
 *
 *     xUser = (clientX - visualLeft) / zoom
 *
 * Whether `getBoundingClientRect` already is visual is **feature-detected**, not
 * hardcoded per browser, by comparing the ratio we can already see
 * (`rect.width / clientWidth`) against the cumulative zoom. So this stays correct
 * if WebKit fixes the bug, and is a no-op when no zoom is applied.
 */

/** Cumulative CSS `zoom` from `el` up through its ancestors (1 when unzoomed). */
function cumulativeZoom(el: Element): number {
  let z = 1
  for (let n: Element | null = el; n; n = n.parentElement) {
    const v = parseFloat(getComputedStyle(n).zoom || '1')
    if (Number.isFinite(v) && v > 0 && v !== 1) z *= v
  }
  return z || 1
}

export function clientPointToSvgUser(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const rect = svg.getBoundingClientRect()
  if (!rect.width || !rect.height) return null

  const zoom = cumulativeZoom(svg)

  // Does this engine bake `zoom` into getBoundingClientRect? If it does, the
  // rect/layout ratio equals the zoom; if not, it is 1. Pick whichever the
  // observed ratio is closer to — no browser sniffing, and a no-op at zoom 1.
  const ratio = svg.clientWidth ? rect.width / svg.clientWidth : 1
  const rectIsVisual = Math.abs(ratio - zoom) < Math.abs(ratio - 1)

  const visualLeft = rectIsVisual ? rect.left : rect.left * zoom
  const visualTop = rectIsVisual ? rect.top : rect.top * zoom

  // Layout px → user units. These charts render without a viewBox (1:1), but
  // honour one if present so the helper is safe to reuse.
  const vb = svg.viewBox?.baseVal
  const ux = vb && vb.width && svg.clientWidth ? vb.width / svg.clientWidth : 1
  const uy = vb && vb.height && svg.clientHeight ? vb.height / svg.clientHeight : 1

  return {
    x: ((clientX - visualLeft) / zoom) * ux,
    y: ((clientY - visualTop) / zoom) * uy,
  }
}

/** `clientPointToSvgUser` for the common x-only case (time-axis lookups). */
export function clientXToSvgUserX(
  svg: SVGSVGElement,
  clientX: number,
  clientY = 0,
): number | null {
  return clientPointToSvgUser(svg, clientX, clientY)?.x ?? null
}
