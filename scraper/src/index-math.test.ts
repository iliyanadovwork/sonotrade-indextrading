import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseListeners, nextIndex, nextEma, MIN_INDEX_VALUE } from './index-math.ts'

test('parseListeners handles Spotify og:description formats', () => {
  assert.equal(parseListeners('Artist · 91.2M monthly listeners.'), 91_200_000)
  assert.equal(parseListeners('Artist · 854.3K monthly listeners.'), 854_300)
  assert.equal(parseListeners('Artist · 1,234 monthly listeners.'), 1234)
  assert.equal(parseListeners('Artist · 12 monthly listeners.'), 12)
  assert.equal(parseListeners('Artist · 1.1B monthly listeners.'), 1_100_000_000)
  assert.equal(parseListeners('Listen to Drake on Spotify.'), null)
  assert.equal(parseListeners(''), null)
})

test('nextIndex moves proportionally to listener change', () => {
  // +1% listeners at K=1 → +1% index
  const s = nextIndex(50, 1_000_000, 1_010_000, 1.0, 0.25)
  assert.equal(s.index, 50.5)
  assert.equal(s.clamped, false)
})

test('nextIndex respects sensitivity K', () => {
  const s = nextIndex(50, 1_000_000, 1_010_000, 2.0, 0.25)
  assert.equal(s.index, 51) // 1% listeners * K=2 → +2%
})

test('nextIndex baselines when no previous listeners', () => {
  const s = nextIndex(50, null, 1_000_000, 1.0, 0.25)
  assert.equal(s.index, 50)
  assert.equal(s.applied, 0)
})

test('nextIndex clamps anomalous moves and reports it', () => {
  // +80% "overnight" — clamp to +25%
  const s = nextIndex(50, 1_000_000, 1_800_000, 1.0, 0.25)
  assert.equal(s.index, 62.5)
  assert.equal(s.clamped, true)
})

test('nextIndex floors at the epsilon, not at a cent', () => {
  const s = nextIndex(0.011, 1_000_000, 750_000, 1.0, 0.25)
  assert.ok(s.index < 0.01, 'a 25% drop from 0.011 must be allowed to go below a cent')
  assert.ok(s.index >= MIN_INDEX_VALUE)
  const tiny = nextIndex(0.000001, 1_000_000, 750_000, 1.0, 0.25)
  assert.equal(tiny.index, MIN_INDEX_VALUE)
})

test('index continuity: zero listener change → identical index (frozen-feed revival)', () => {
  const s = nextIndex(50.028532, 5_000_000, 5_000_000, 1.0, 0.25)
  assert.equal(s.index, 50.028532)
})

test('nextEma seeds from index and then smooths', () => {
  assert.equal(nextEma(null, 50), 50)
  assert.equal(nextEma(50, 60, 0.2), 52) // 0.2*60 + 0.8*50
})
