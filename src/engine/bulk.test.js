import { describe, it, expect } from 'vitest'
import { createEngine } from './core.js'

describe('Bulk cell operations', () => {
    it('updates multiple cells', () => {
        const engine = createEngine(50, 50)

        engine.setCells([
            { row: 0, col: 0, value: '100' },
            { row: 1, col: 0, value: '200' },
            { row: 2, col: 0, value: '300' }
        ])

        expect(engine.getCell(0, 0).raw).toBe('100')
        expect(engine.getCell(1, 0).raw).toBe('200')
        expect(engine.getCell(2, 0).raw).toBe('300')
    })

    it('undoes an entire bulk edit in one step', () => {
        const engine = createEngine(50, 50)

        engine.setCells([
            { row: 0, col: 0, value: '100' },
            { row: 1, col: 0, value: '200' },
            { row: 2, col: 0, value: '300' }
        ])

        engine.undo()

        expect(engine.getCell(0, 0).raw).toBe('')
        expect(engine.getCell(1, 0).raw).toBe('')
        expect(engine.getCell(2, 0).raw).toBe('')
    })

    it('redoes an entire bulk edit', () => {
        const engine = createEngine(50, 50)

        engine.setCells([
            { row: 0, col: 0, value: '100' },
            { row: 1, col: 0, value: '200' }
        ])

        engine.undo()
        engine.redo()

        expect(engine.getCell(0, 0).raw).toBe('100')
        expect(engine.getCell(1, 0).raw).toBe('200')
    })
})