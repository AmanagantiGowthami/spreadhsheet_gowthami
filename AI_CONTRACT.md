# AI action contract

This document is the precise specification behind `src/ai/contract.js`. The golden sets in `fixtures/ai-eval/` were generated from these rules; if your implementation and this document disagree, this document wins.

**Principle: the model translates, the engine computes.** The model may only produce one of the actions below. Your code validates it, then executes or applies it deterministically. No number a user sees may originate in model output.

---

## 1. Request and response envelope

Your code sends the provider:

- a **system prompt** you write: the task, the JSON schema of the allowed actions, the rules below, and an instruction to answer with a single JSON object and nothing else;
- a **user turn** containing the sheet context and the user's prompt;
- optional **history** for multi-turn refinement.

The provider returns raw text. You must:

1. extract the first JSON object from it (models add prose and code fences; the mock does too);
2. parse it; a parse failure is error `INVALID_RESPONSE`;
3. validate it against the schema for its `type`; a validation failure is `INVALID_RESPONSE` and must include *what* failed;
4. only then hand it to the executor or the applier.

### Sheet context (what the model is allowed to know)

Recommended shape; document what you actually send:

```json
{
  "range": "A1:J33",
  "rowCount": 32,
  "columns": [
    { "name": "Order ID", "index": 0, "type": "id",       "examples": ["ORD-1001", "ORD-1002"] },
    { "name": "Date",     "index": 1, "type": "date",     "examples": ["2024-01-03", "1/8/2024", "15 Jan 2024"] },
    { "name": "Discount", "index": 8, "type": "percent",  "examples": ["10%", "0.1", "n/a"] }
  ],
  "sampleRows": [["ORD-1001", "2024-01-03", "..."]],
  "selection": "C2:C10",
  "hasTotalsRow": true
}
```

Rules: at most five sample rows; never the whole sheet; column names exactly as in the header (the model must use them verbatim in plans).

---

## 2. Actions

### 2.1 `clarify`

```json
{ "type": "clarify", "question": "Which column holds the revenue: Total or Unit Price?" }
```

Shown to the user as a question. Nothing is executed.

### 2.2 `query` (read-only analysis plan)

```json
{
  "type": "query",
  "excludeTotalsRow": true,
  "filters":    [{ "column": "Region", "op": "eq", "value": "West" }],
  "groupBy":    ["Region"],
  "aggregates": [{ "fn": "sum", "column": "Total", "as": "Total Sales" }],
  "columns":    ["Order ID", "Total"],
  "sort":       [{ "column": "Total Sales", "dir": "desc" }],
  "limit":      10
}
```

| Field | Meaning |
|---|---|
| `excludeTotalsRow` | default `true`; drop the last row when it looks like a totals row (§3.1). |
| `filters` | all must hold (AND). `op` ∈ `eq neq gt gte lt lte contains startsWith endsWith isEmpty notEmpty`. |
| `groupBy` | column names; zero or more. |
| `aggregates` | `fn` ∈ `sum avg count countDistinct min max`; `as` names the output column, default `fn(column)`. |
| `columns` | only for row results (no aggregates): which source columns to return, default all. |
| `sort` | applied in order; first entry is primary. `column` names an output column (a group-by column, an aggregate alias, or a source column for row results). `dir` default `asc`. |
| `limit` | positive integer. Absent means 500. Anything above 500 is **clamped to 500** by the executor; never return more than 500 rows. |

Any other `type` (for example `mutation`) is rejected with `READ_ONLY` before execution.

### 2.3 `format_sheet` (formatting intent)

```json
{
  "type": "format_sheet",
  "clearFormatting": false,
  "headerStyle": { "bold": true, "bg": "#f0f0f0", "align": "center" },
  "bodyStyle":   { "fontSize": 12 },
  "columns":     [{ "col": 7, "style": { "align": "right", "numberFormat": "currency" } }],
  "totalsStyle": { "bold": true },
  "freezeRows":  1,
  "columnWidths": [{ "col": 0, "width": 90 }],
  "autoFitColumns": true
}
```

A style object may contain `bold italic underline bg color align fontSize numberFormat`; `numberFormat` ∈ `general number currency percent date`. `freezeRows` is an integer or `null`: a number is an instruction (`0` unfreezes), `null` or absent means "not mentioned".

---

## 3. Query execution semantics

Everything operates on **computed** cell values (what the grid shows before number formatting), read from the sheet's used range with row 1 as the header.

### 3.1 Rows

- A row whose cells are all empty (after trim) is skipped.
- The **totals row** is the last used row when its first non-empty cell matches `/^(grand\s+)?(total|totals|subtotal|sum)\b/i`. It is excluded unless `excludeTotalsRow` is `false`.
- A duplicate row is a row. (`countDistinct` is how a user tells duplicates apart.)

### 3.2 Normalisation

- **Text key** `norm(v)`: `String(v).trim().toLowerCase()`. Used for `eq`/`neq`/`contains`/`startsWith`/`endsWith`, group-by keys and `countDistinct`.
- **Number** `toNum(v)`: trim; note a trailing `%`; strip `$ , %` and whitespace; the remainder must match `^-?\d+(\.\d+)?$`, otherwise it is *not a number* (`null`); a trailing `%` divides by 100. So `$1,200.00` → 1200, `10%` → 0.1, `0.1` → 0.1, `$ 49.99` → 49.99, `N/A` → null, `n/a` → null, `` → null.
- **Date** `toDate(v)`: accepts `YYYY-M-D`, `M/D/YYYY`, `D Mon YYYY` (English month, three or more letters); returns the ISO day `YYYY-MM-DD` or `null`. Comparisons are on that string.
- Column names are matched case-insensitively after trim. An unmatched name is error `UNKNOWN_COLUMN` with the offending name; the UI must ask the user, never pick a similar column.

### 3.3 Filters

For a cell `c` and filter value `v`:

| op | rule |
|---|---|
| `eq` / `neq` | if both `toNum(c)` and `toNum(v)` are numbers, compare numerically; otherwise compare `norm(c)` with `norm(v)`. |
| `gt gte lt lte` | if `v` parses as a date, compare `toDate(c)` with it (a cell that is not a date fails the filter); otherwise compare `toNum(c)` with `toNum(v)` (a non-number on either side fails). |
| `contains` / `startsWith` / `endsWith` | on `norm` of both. |
| `isEmpty` / `notEmpty` | `norm(c) === ''`. |

### 3.4 Grouping and aggregates

- Group key is the tuple of `norm` values of the `groupBy` columns; the displayed label is the **trimmed value of the first row seen** in that group (`West ` and `west` join `West`; the label is whichever came first).
- `count`: number of rows whose cell is non-empty after trim. `countDistinct`: number of distinct non-empty `norm` values. `sum avg min max`: over `toNum` values that are numbers; with no numeric values the result is `null`.
- Output columns are `[...groupBy, ...aggregates]`. With no aggregates the result is the filtered rows projected on `columns` (raw cell text, untrimmed).

### 3.5 Sort, limit, result

- Sort entries apply with the first as primary. Numeric when both values are numbers, otherwise numbers before non-numbers, otherwise `norm` text compare. Stable.
- `limit` defaults to 500 and is capped at 500. `truncated` is `true` when rows were cut.
- Numbers in the result are rounded to 2 decimals for display and for the golden comparison (±0.01).

Result shape:

```json
{ "columns": ["Region", "Total Sales"], "rows": [["East", 23304.36]], "rowCount": 1, "truncated": false }
```

Errors: `{ "error": "UNKNOWN_COLUMN", "detail": "UNKNOWN_COLUMN:Territory" }`, likewise `UNKNOWN_OP`, `UNKNOWN_FN`, `UNKNOWN_SORT_COLUMN`, `READ_ONLY`, `INVALID_RESPONSE`, `PROVIDER_ERROR`.

---

## 4. Format application semantics

Derived from our production applier. The sheet's **used range** is the bounding box of non-empty cells; `colCount` comes from the sheet, never from the action.

1. Row 1 is the **header**. The **body** is row 2 to the last used row. A sheet with one row has no body.
2. The **totals row** is the last used row only if it looks like one: its first filled cell matches the regex in §3.1, **or** it reads as a summary line (a non-numeric label first, then numbers, with at least one column left empty, and at least two filled cells, not all cells filled). Otherwise `totalsStyle` is dropped silently.
3. Order of application, which is load-bearing: `clearFormatting` first (over the whole used range); then `bodyStyle` (body rows, all used columns); then each `columns[]` entry (body rows of that column; the header row is never number-formatted or realigned by a column entry); then `totalsStyle`; then `headerStyle` **last** so it wins over column alignment.
4. Column indices outside `0..colCount-1` are ignored; nothing is ever written outside the used range. Widths outside 30..600 are ignored.
5. `freezeRows`: a number is applied when it differs from the current state; `0` unfreezes; `null`/absent is untouched. A value that would freeze every used row (≥ used row count) is refused with `OUT_OF_RANGE` and nothing else in the action is applied.
6. `autoFitColumns` measures real text and is applied after everything else.
7. If nothing changed, the result is `NO_CHANGES` and **no undo entry** is created. Otherwise the whole action is **one undo step**.

Display rules for `numberFormat` (stored value never changes):

| format | `79` | `$1,200.00` | `0.1` | `10%` | `n/a` | `2024-01-15` / `1/15/2024` / `15 Jan 2024` |
|---|---|---|---|---|---|---|
| `number` | `79.00` | `1,200.00` | `0.10` | `0.10` | `n/a` | unchanged |
| `currency` | `$79.00` | `$1,200.00` | `$0.10` | `$0.10` | `n/a` | unchanged |
| `percent` | `7900%` | `120000%` | `10%` | `10%` | `n/a` | unchanged |
| `date` | unchanged | unchanged | unchanged | unchanged | `n/a` | `2024-01-15` |

---

## 5. How graders check

- `fixtures/ai-eval/queries.json` was computed over `fixtures/sales-large.tsv` (*Sample 3k*) with the rules in §3. For each case, `plan` is what the mock returns and `expect` is the result: `columns` exact, numbers within 0.01, row order only when the plan sorts, `error` codes exact. Row results with more than 25 rows carry `rowsPreview` (first 10) plus an exact `rowCount` and `truncated`.
- `fixtures/ai-eval/format-prompts.json` is over `fixtures/sales.tsv` (*Sample 33*). For each case, `expect` lists cell styles, displayed text, raw values, frozen rows, undo steps or a `result` code that must hold after applying the action.
- Graders type the prompts into your panel in mock mode, then with a live key through your http provider, and compare against these files. They also watch your recording. You are free (and encouraged) to write your own tests against these files, but no particular harness is required.
- If you add a backend, the contract is unchanged: the model still returns one of these actions, your code still validates it, and the numbers still come from your executor, wherever it runs.
