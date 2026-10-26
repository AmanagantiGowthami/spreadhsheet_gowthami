import { describe, it, expect } from 'vitest'

import {
fillNumericSeries,
incrementTextSuffix,
fillFormula
} from './fill.js'

describe('Fill utilities', () => {
it('continues a numeric series', () => {
expect(
fillNumericSeries(1, 2, 3)
).toEqual([3, 4, 5])
})

it('increments order IDs', () => {
expect(
incrementTextSuffix('ORD-1001', 3)
).toBe('ORD-1004')
})

it('preserves zero padding', () => {
expect(
incrementTextSuffix('2024-W01', 2)
).toBe('2024-W03')
})

it('shifts relative formula references', () => {
expect(
fillFormula('=G2*H2', 1, 10, 31, 10)
).toBe('=G32*H32')
})

it('preserves absolute formula references', () => {
expect(
fillFormula('=$G$2*H2', 1, 11, 31, 11)
).toBe('=$G$2*H32')
})
})
