// ─────────────────────────────────────────────────────────────
//  AI action contract — the ONLY things a language model is
//  allowed to hand back to the app. Full semantics: AI_CONTRACT.md
//
//  Principle: the model TRANSLATES, the engine COMPUTES.
//  No number shown to the user may originate from model output.
// ─────────────────────────────────────────────────────────────

export const ACTION_TYPES = Object.freeze({
    QUERY: 'query',               // read-only analysis plan, executed by YOUR executor
    FORMAT_SHEET: 'format_sheet', // formatting intent, applied through YOUR style system
    CLARIFY: 'clarify',           // the model needs more information from the user
})

export const FILTER_OPS = Object.freeze([
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'contains', 'startsWith', 'endsWith', 'isEmpty', 'notEmpty',
])

export const AGGREGATE_FNS = Object.freeze(['sum', 'avg', 'count', 'countDistinct', 'min', 'max'])

export const MAX_RESULT_ROWS = 500

export const NUMBER_FORMATS = Object.freeze(['general', 'number', 'currency', 'percent', 'date'])

// JSON Schemas (draft-07 style). Use them to build your prompt AND to
// validate what comes back. A response that does not validate must never
// reach the executor or the style system.
export const QUERY_PLAN_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['type'],
    properties: {
        type: { const: ACTION_TYPES.QUERY },
        excludeTotalsRow: { type: 'boolean', default: true },
        filters: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false, required: ['column', 'op'],
                properties: {
                    column: { type: 'string' },
                    op: { enum: [...FILTER_OPS] },
                    value: { type: ['string', 'number', 'null'] },
                },
            },
        },
        groupBy: { type: 'array', items: { type: 'string' } },
        aggregates: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false, required: ['fn', 'column'],
                properties: {
                    fn: { enum: [...AGGREGATE_FNS] },
                    column: { type: 'string' },
                    as: { type: 'string' },
                },
            },
        },
        columns: { type: 'array', items: { type: 'string' } },
        sort: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false, required: ['column'],
                properties: { column: { type: 'string' }, dir: { enum: ['asc', 'desc'] } },
            },
        },
        // Values above MAX_RESULT_ROWS are clamped by the executor, never honoured.
        limit: { type: 'integer', minimum: 1 },
    },
})

const STYLE_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: {
        bold: { type: 'boolean' },
        italic: { type: 'boolean' },
        underline: { type: 'boolean' },
        bg: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$|^white$' },
        color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        align: { enum: ['left', 'center', 'right'] },
        fontSize: { type: 'integer', minimum: 8, maximum: 24 },
        numberFormat: { enum: [...NUMBER_FORMATS] },
    },
})

export const FORMAT_SHEET_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['type'],
    properties: {
        type: { const: ACTION_TYPES.FORMAT_SHEET },
        clearFormatting: { type: 'boolean' },
        headerStyle: STYLE_SCHEMA,
        bodyStyle: STYLE_SCHEMA,
        totalsStyle: STYLE_SCHEMA,
        columns: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false, required: ['col', 'style'],
                properties: { col: { type: 'integer', minimum: 0 }, style: STYLE_SCHEMA },
            },
        },
        // integer | null. 0 means "unfreeze"; null / absent means "not mentioned".
        freezeRows: { type: ['integer', 'null'], minimum: 0 },
        columnWidths: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false, required: ['col', 'width'],
                properties: { col: { type: 'integer', minimum: 0 }, width: { type: 'integer', minimum: 30, maximum: 600 } },
            },
        },
        autoFitColumns: { type: 'boolean' },
    },
})

export const CLARIFY_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['type', 'question'],
    properties: {
        type: { const: ACTION_TYPES.CLARIFY },
        question: { type: 'string' },
    },
})
