import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { deepFreeze, isJsonValue, snapshotJsonValue } from '../src/index.ts'

describe('JSON traversal under mutation', () => {
  it('revalidates previously accepted mutable records and arrays', () => {
    const value: Record<string, unknown> = { items: [1] }
    expect(isJsonValue(value)).toBe(true)
    const items = value.items as unknown[]
    items.push(undefined)
    expect(isJsonValue(value)).toBe(false)
    expect(snapshotJsonValue(value)).toBeUndefined()
    value.items = [1]
    Object.defineProperty(value, 'hidden', { value: true })
    expect(isJsonValue(value)).toBe(false)
  })

  it('reads siblings after their descendants and observes a removed array slot', () => {
    const order: string[] = []
    const array: unknown[] = [null, 2]
    Object.defineProperty(array, 0, {
      enumerable: true,
      get() {
        order.push('first')
        return {
          get child() {
            order.push('child')
            Reflect.deleteProperty(array, '1')
            return true
          },
        }
      },
    })
    expect(snapshotJsonValue(array)).toBeUndefined()
    expect(order).toEqual(['first', 'child'])
  })

  it('rechecks an intrinsic prototype after another realm changes its constructor', () => {
    const foreign = runInNewContext(`({ value: { nested: [1] }, corrupt() {
      Object.prototype.constructor = function Object() {}
    } })`) as { value: unknown; corrupt(): void }
    expect(isJsonValue(foreign.value)).toBe(true)
    foreign.corrupt()
    expect(isJsonValue(foreign.value)).toBe(false)
  })

  it('detaches wide snapshots before freezing without retaining mutable aliases', () => {
    const shared = { value: 1 }
    const source = Array.from({ length: 10_000 }, () => shared)
    const snapshot = deepFreeze(snapshotJsonValue(source)!)
    shared.value = 2
    expect(snapshot).toHaveLength(10_000)
    expect(snapshot[0]).toEqual({ value: 1 })
    expect(snapshot[0]).not.toBe(snapshot[1])
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot[9_999])).toBe(true)
  })
})
