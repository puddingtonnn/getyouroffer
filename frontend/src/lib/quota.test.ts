import { beforeEach, describe, expect, it } from 'vitest'
import { consumeFree, FREE_LIMIT, freeLeft } from './quota'

describe('quota', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to the full free limit', () => {
    expect(freeLeft()).toBe(FREE_LIMIT)
  })

  it('decrements on consume and floors at zero', () => {
    expect(consumeFree()).toBe(FREE_LIMIT - 1)
    consumeFree()
    consumeFree()
    expect(freeLeft()).toBe(0)
    expect(consumeFree()).toBe(0)
  })

  it('recovers from a corrupted stored value', () => {
    localStorage.setItem('gyo_free_left', 'not-a-number')
    expect(freeLeft()).toBe(FREE_LIMIT)
    localStorage.setItem('gyo_free_left', '999')
    expect(freeLeft()).toBe(FREE_LIMIT)
    localStorage.setItem('gyo_free_left', '-5')
    expect(freeLeft()).toBe(0)
  })
})
