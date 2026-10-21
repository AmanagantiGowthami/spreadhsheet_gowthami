# Spreadsheet Engineering Challenge

Build features for a browser spreadsheet. There are five challenges below: three core features and two AI features. **All five are required.** Read the whole document before you start.

Test data is in `fixtures/`:

- `fixtures/sales.tsv`: 33 rows of deliberately messy sales data
- `fixtures/sales-large.tsv`: about 3,000 rows of the same shape
- `fixtures/ai-eval/`: golden prompts and expected results for the AI challenges

---

## Ground rules

1. **Keep the engine pure.** Spreadsheet logic (cells, formulas, sorting, query execution, formatting rules) must not import React or touch the DOM. Document every engine method you add in `DESIGN_NOTES.md`.
2. **No spreadsheet, formula, grid or AI vendor libraries.** Plain `fetch` is fine. Any other runtime dependency needs a written justification in `DESIGN_NOTES.md`.
3. **A backend is optional.** If you add one, put it in `server/`, start it with `npm run server`, and keep the app working without it in mock mode.
4. **Undo matters.** Every bulk action (fill, sort, AI apply, insert into sheet) reverts in **one** `Ctrl+Z`. State in `DESIGN_NOTES.md` what one undo reverts for each action you add.
5. **`npm run lint` and `npm run build` must pass.**
6. **Small, descriptive commits.** We read the history.
7. **Performance budgets are measured on a production build.** Report each number and how you measured it.

## On using AI assistants

You may use AI tools. Every submission ends with a **live walkthrough** where you explain your design and make a change we pick, in your own code. Code you cannot explain or extend counts against you.

---

## Core challenges

### 1. Range selection and fill handle

**Requirements**

1. **Selection.** Single click selects; double-click, `Enter`, `F2` or typing starts editing. Drag selects a rectangle; `Shift+Click` and `Shift+Arrow` extend; clicking a row or column header selects the whole row/column; `Ctrl+A` selects the used range. Formatting applies to the whole selection. `Delete`/`Backspace` clears the selection as one undo step.
2. **Fill handle.** A small square at the selection's bottom-right corner. Dragging it in any direction fills from the seed cells:
   - one seed → copy; numeric seeds `1, 2` → `3, 4, …`;
   - text ending in a number (`Item 1`, `Q4`, `2024-W01`) → increments, preserving zero padding;
   - dates (`2024-01-15`, `1/15/2024`) step by the seed delta in days, keeping the seed's format;
   - weekday and month names cycle (`Mon → Tue`, `Jan → Feb`), preserving case;
   - formulas shift relative references; `$A$1`, `$A1`, `A$1` stay pinned (support absolute references end to end);
   - filled cells inherit the seed's style; dragging back shrinks the fill.
3. **Budget.** Filling 5,000 cells completes in under 200 ms.

**Acceptance** (on `sales.tsv`)

- Select `A2:A3` (`ORD-1001`, `ORD-1002`), drag to `A6`: `A4:A6` become `ORD-1003` … `ORD-1005`. One undo restores them.
- Put `=G2*H2` in `K2` and `=$G$2*H2` in `L2`, fill to row 32: `K32` is `=G32*H32`, `L32` is `=$G$2*H32`.
- Insert a row above row 10: `L33` now reads `=$G$2*H33`.
- Select `B2:B4` (three date formats), fill to `B8`: each cell keeps its seed's format.

### 2. Sort and filter

Filters are a view; sort is a physical edit.

**Requirements**

1. **Filter.** A dropdown on each column header with a search box, a checklist of distinct values plus `(Blanks)`, and conditions (`contains`, `greater than`, `less than`, `is empty`). Filters on several columns combine with AND. Hidden rows still take part in formulas, row numbers show gaps, and a status line reads e.g. `28 of 32 rows`. Clear per column and clear all.
2. **Sort.** Clicking a header sorts the data block: the selection if there is one, otherwise the used range with row 1 as header and a trailing totals row pinned at the bottom. Ascending → descending → original order. Comparison: numbers before text, blanks last, dates as dates, text case-insensitive, stable. Returning to the original order requires a stable row identity.
3. **Formulas follow rows.** References to moved rows point to where those rows went. A range spanning the whole block (`=SUM(J2:J32)`) is unchanged. Styles move with their rows.
4. With a filter active, sort reorders only visible rows.
5. **Budget.** One undo step per sort. Sorting 10,000 rows takes under 300 ms.

**Acceptance** (on `sales.tsv`)

- Put `=J2/G2` in `K2`, fill to `K32`. Sort by *Total* descending: `K2` shows ORD-1025's price per unit (`1080`), `A33` still reads `Total`, the blank row sorts last.
- Filter *Region* to `West` (should also match `West ` and `west`, or explain why not), then sort by *Units*: hidden rows don't move.
- Undo twice: original order and no filter.
- On `sales-large.tsv`, sort by *Date* and report the time.

### 3. Virtualized grid at scale

**Requirements**

1. A grid of **100,000 rows × 200 columns**. Render only visible rows and columns plus overscan; use prefix sums with binary search for offsets.
2. **Column resize** by dragging the header border, **auto-fit** on double-click, and adjustable **row heights**. Sizes move with their columns/rows on insert/delete.
3. **Frozen** first row and first column, scroll-synced with the body.
4. Selection, editing, keyboard navigation (`Ctrl+Home`, `Ctrl+End`, `Page Up/Down`), a name box that jumps to e.g. `AZ5000`, and a formula bar all work while scrolled far from the origin.
5. **Budgets.** First paint under 100 ms; scrolling at 60 fps; keystroke latency under 16 ms with 50,000 filled cells; no React state per cell. Edits recalculate only dependent cells.

**Acceptance**

- Load `sales-large.tsv`, fill `K2` = `=J2*2` down to row 100,000 (document how).
- Scroll to row 95,000 with the devtools performance panel recording, type into `J95000`, and show the commit count and frame time.
- Freeze row 1, resize column D to 300 px, insert a column before D: the new column has the default width and the old D kept 300 px.

---

## AI challenges

**The model translates, the engine computes.** The model turns natural language into a small JSON action; your code validates and executes it deterministically. No number a user sees may come from the model.

### Shared requirements

- **Provider abstraction.** A provider interface with a deterministic **mock** that answers the prompts in `fixtures/ai-eval/`, and an **http** provider for any LLM API you choose, using plain `fetch` (endpoint, key and model from `.env.local`; see `.env.example`). Nothing else may know which vendor you picked. Never commit a key.
- **Contract.** Actions, JSON Schemas and semantics are defined in `AI_CONTRACT.md`. Validate every response against the schema before anything touches the sheet; write the validator yourself. Invalid JSON or a failed validation shows an error and changes nothing.
- **Response parsing.** Models wrap JSON in prose and code fences. Handle it.
- **Context.** Send column headers, an inferred type per column (`number`, `currency`, `percent`, `date`, `text`, `id`), five sample rows, the row count and the current selection. **Never the full data.** Document the exact shape.
- **Panel.** `Ctrl+K` opens a side panel with a prompt input, conversation history, result cards, and a "show plan" toggle for the raw action JSON. Provider errors (network, auth, rate limit) are shown, never swallowed.
- **Pure logic.** The executor and applier are pure functions over sheet data (no React).
- **Recording.** Show at least eight query prompts and five format prompts from the golden sets, with the plan visible.

### 4. Ask your data

A question becomes a read-only `query` plan, executed by your code over the sheet's computed values.

**Requirements**

1. **Flow.** Prompt → plan → validate → execute → a result card with a table, the row count, a plain-words description of the plan (JSON on demand), **Re-run** (no model call, same result) and **Insert into sheet** (writes values at a chosen cell, one undo step). A `clarify` action shows the model's question.
2. **Executor**, following `AI_CONTRACT.md` exactly: header row, blank rows skipped, totals row excluded by default, text normalisation (trim, case-insensitive), number coercion (`$1,200.00` → 1200, `10%` → 0.1, `N/A` → not a number), the three sample date formats, AND filters, group-by on normalised keys with the first-seen label, aggregates, multi-key stable sort, limit capped at 500.
3. **Guardrails.** Any non-`query` action is rejected. An unknown column asks the user instead of guessing. The limit cap is enforced in code.
4. **Budget.** Any golden plan over `sales-large.tsv` runs in under 50 ms; a two-level group-by over 100,000 generated rows in under 500 ms. The panel stays responsive.

**Golden set.** `fixtures/ai-eval/queries.json`: twenty prompts over `sales-large.tsv` (seventeen answers, three refusals) with the expected plan and result.

### 5. Format with AI

"Format this as a clean table" becomes a `format_sheet` action, applied through the style system.

**Requirements**

1. **Flow.** Prompt → action → a plain-words **preview** ("header: bold, grey; 4 columns: number formats; freeze 1 row; totals row: bold") → *Apply* (one undo step) or *Discard*.
2. **Display features:**
   - `numberFormat` cell style: `number` (`1,200.00`), `currency` (`$1,200.00`), `percent` (`0.1` and `10%` both display `10%`), `date` (all three sample formats display as `2024-01-15`). Formatting never changes the stored value; non-numeric text is left alone.
   - **Freeze rows**, **column widths** and **auto-fit**.
3. **Applying** (exact rules in `AI_CONTRACT.md`): row 1 is the header, the body runs to the last used row; `totalsStyle` applies only if the last row looks like a totals row; `clearFormatting` runs first; header style is applied last; the header is never number-formatted; column indices are clamped to the used range; `freezeRows: 0` unfreezes, absent means unchanged; no-op actions report `NO_CHANGES` with no undo entry; out-of-range requests report `OUT_OF_RANGE` and change nothing.
4. **Styles follow structure.** Styles shift with insert/delete row/column, with undo.

**Golden set.** `fixtures/ai-eval/format-prompts.json`: ten prompts over `sales.tsv` with the expected action and checks. Then run them on `sales-large.tsv`: the totals row is row 2,992 there, and applying must take under 300 ms.

---

## What we grade

| Criterion | Weight |
|---|---|
| Correctness against acceptance checks and golden sets | 30% |
| Design and code quality: clear data model, documented API, sensible undo | 25% |
| Measured performance budgets | 25% |
| Live walkthrough | 20% |

What loses points fastest: silent failures, numbers that come from a model, undo that half-works, an engine that imports React, a feature that only works on tidy data.

## Submission

1. Fork the repository. One branch and one pull request per challenge (e.g. `challenge-1-fill-handle`, `challenge-4-ask-data`).
2. Fill in `DESIGN_NOTES.md`: data model, engine API added, undo semantics per action, measurements with method, what you would do next.
3. Attach a screen recording per challenge running its acceptance checks and explaining how the code works.
4. `npm run lint` and `npm run build` pass on each branch; `npm run server` starts the backend if you added one.

We will then schedule the walkthrough.
