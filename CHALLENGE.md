# Spreadsheet Engineering Challenge

This repository is a small browser spreadsheet: a sparse cell engine with formulas, dependency tracking and undo (`src/engine/core.js`) and a single-file React UI (`src/App.jsx`). It is deliberately simple. The tasks below ask you to grow it toward a real product, feature by feature, the way our own spreadsheet product grew.

**Read this whole document before writing code.** Then read `src/engine/core.js` end to end. Then load the small sample (toolbar → *⬇ Sample 33*) and look at what the grid actually shows. Then load the large one (*⬇ Sample 3k*, about 3,000 rows) and watch what happens to the app.

---

## On using AI assistants

You may use AI tools. We assume you will. The tasks are written with that in mind:

- They depend on **quirks of this codebase** that no model knows. The engine contains defects beyond the ones named in Task 0. Some will bite your feature. Finding and fixing the ones you hit is part of the work, and you must list each one you fixed, with its root cause, in `DESIGN_NOTES.md`.
- They are graded against **deliberately messy data** (`fixtures/sales.tsv`) and **golden expectations** (`fixtures/ai-eval/`), not against a description.
- Several have **measured performance budgets**. A production build is what we measure.
- Every submission ends with a **live walkthrough**: you explain your design, then make a change we pick on the spot, in your own code, in about 20 minutes. Code you cannot explain or extend counts against you, however it was produced.

Treat generated code as a draft from a junior colleague: review it, test it, own it.

---

## Ground rules

1. **Engine stays pure.** `src/engine/` must not import React or touch the DOM. Everything the UI needs from the engine goes through documented methods. Document every method you add in `DESIGN_NOTES.md`.
2. **No spreadsheet, formula, grid or AI vendor libraries.** Plain `fetch` is fine for the AI tasks. Adding any other runtime dependency requires a written justification in `DESIGN_NOTES.md`. Test tooling as devDependencies is fine.
   **A backend is optional.** If you want one (for example a small Node server that holds the LLM key, runs the query executor, or persists sheets), put it in `server/`, make it start with one command (`npm run server`), document it, and keep the app working without it in mock mode. A backend does not change what the model is allowed to do (see `AI_CONTRACT.md`).
3. **Undo is a feature, not an afterthought.** For every user action you add, state in `DESIGN_NOTES.md` what one `Ctrl+Z` reverts. Bulk operations (paste, fill, sort, AI apply) revert in **one** step.
4. **`npm run lint`, `npm run build` and `npm test` must pass** on your final commit. Write tests for what you build; graders add hidden tests against the engine API you document.
5. **Small, descriptive commits.** We read the history.
6. **Keep both *Sample* buttons working.** Graders use them to load `fixtures/sales.tsv` (33 rows) and `fixtures/sales-large.tsv` (about 3,000 rows) at `A1` for every check.

---

## What to deliver

| Required | Choose | Bonus |
|---|---|---|
| **Task 0** (warm-up) | **one** task from the Core track **and one** from the AI track | a second Core task, or the second AI task |

Suggested time: **5 days** from receiving the link. Quality over quantity; a complete, tested, explained task beats two half-finished ones.

Submit as described in [Submission](#submission).

---

## Task 0 — Warm-up (mandatory, about half a day)

Load *Sample 33*. Then:

1. In `G34` enter `=SUM(G2:G32)`. It shows `#PARSE!`. Every range function does. Find the root cause in the parser and fix it with the **smallest** change that makes range functions work (do not rewrite the parser unless you are also taking C4). Make the first starter test in `src/engine/core.test.js` pass, and add tests for `=SUM(A1:A3)*2`, `=2*MAX(A1:A3)`, `=SUM(A1:A3)+SUM(B1:B3)` and `=(AVG(A1:A3))`.
2. Look at the *Date* and *Discount* columns. `15 Jan 2024` displays as `15`; `1/8/2024` as `1`; `10%` as `10`. Decide what the correct rule for "this cell is a number" is, implement it in the engine, and add tests: `3 apples` must stay text, `  42 ` is 42, `007` is 7, `1e3` is 1000, `$1,200.00` stays text for now (A1 changes that), `-` stays text.
3. Load *Sample 3k*. The grid now has about 3,000 rows and the app is close to unusable: every keystroke re-renders 150,000 cells. Make it usable: scrolling smooth, typing responsive, `=SUM(J2:J2991)` correct (compare it with the totals row). Rendering only the rows in view (plus a margin) is enough here; C5 is the full version with columns, resizing and freezing. Report the keystroke latency you measured before and after.
4. Write a few sentences in `DESIGN_NOTES.md` on why each problem existed.

Everything after this point is built on top of your Task 0 branch, and every acceptance check in this document is run on the 3,000-row sample unless it says otherwise.

---

## Core track (choose at least one)

Each task names the real product feature it mirrors. Requirements are minimums; acceptance checks are what graders do by hand, in this order, on your production build.

### C1 — Range selection and fill handle

The grid today edits on single click and has no concept of a selection larger than one cell.

**Requirements**

1. **Selection model.** Single click *selects* (no edit). Double-click, `Enter`, `F2` or typing a character starts editing. Drag selects a rectangle; `Shift+Click` and `Shift+Arrow` extend; clicking a row or column header selects the whole row/column; `Ctrl+A` selects the used range. The selection survives insert/delete row/column in the obvious way. Toolbar formatting applies to the whole selection. `Delete`/`Backspace` clears the selection as **one** undo step.
2. **Fill handle.** A small square at the selection's bottom-right corner. Dragging it down/right/up/left fills from the seed cells:
   - one seed → copy; numeric seeds `1, 2` → `3, 4, …` (step from the seeds; non-arithmetic seeds repeat as a pattern);
   - text ending in a number `Item 1`, `Q4`, `2024-W01` → increments the number, preserving zero padding;
   - dates in ISO `2024-01-15` and US `1/15/2024` step by the seed delta in days, keeping the seed's format;
   - weekday and month names cycle (`Mon → Tue`, `Jan → Feb`), preserving case;
   - formulas shift relative references by the fill delta; `$A$1`, `$A1`, `A$1` stay pinned. **The tokenizer currently throws on `$`**: support absolute references end to end (parse, evaluate, shift on insert/delete, display).
   - Filled cells inherit the seed's style. Dragging back inside the original selection shrinks the fill (clears what was filled). One undo step per fill.
3. **Budget.** Filling 5,000 cells completes in under 200 ms (measure with `performance.now()`, report the number).

**Acceptance.** Load *Sample 33*. Select `A2:A3` (`ORD-1001`, `ORD-1002`) and drag the handle to `A6`: `A4:A6` become `ORD-1003`, `ORD-1004`, `ORD-1005`, overwriting what was there; one undo restores the three cells. Put `=G2*H2` in `K2` and `=$G$2*H2` in `L2`, fill both to row 32, verify `K32` is `=G32*H32` and `L32` is `=$G$2*H32`. Insert a row above row 10 and verify `L33` now reads `=$G$2*H33`. Select `B2:B4` (three date formats) and fill to `B8`: each cell keeps its own seed's format.

### C2 — Sort and filter

Mirrors our product's view layer: **filters are a view, sort is a physical edit.**

**Requirements**

1. **Filter (view-only).** A dropdown on each column header with a search box, a checklist of the column's distinct *computed* values plus `(Blanks)`, and a condition filter (`contains`, `greater than`, `less than`, `is empty`). Filters on several columns combine with AND. Hidden rows are hidden, not deleted: they keep taking part in formulas, row headers keep their original numbers (so the numbering shows gaps), and a status line reads `28 of 32 rows`. Clear per column and clear all.
2. **Sort (physical).** Clicking a header sorts the **data block**: the selected range if one is selected, otherwise the used range with its first row treated as the header and a trailing totals row (same heuristic as `AI_CONTRACT.md` §3.1) pinned at the bottom. Blank rows inside the block sort last. Ascending → descending → original order. Comparison is typed on computed values: numbers before text, blanks last, dates as dates when the column is mostly dates, text case-insensitive and locale-aware, stable. Returning to the original order after two physical sorts requires a **stable row identity**: design it, it is the heart of this task.
3. **Formulas follow rows.** When rows move, a formula in a moved row moves with it, and its relative references to other moved rows must point at where those rows went (`=G5*H5` whose row lands on row 9 becomes `=G9*H9` **only if** row 5's data also landed on row 9; otherwise it points at wherever row 5's data went). References from outside the block into it follow the moved cells. A range that spans the whole block (`=SUM(J2:J32)`) is unchanged. Styles move with their rows.
4. With a filter active, sort reorders only the visible rows and leaves hidden rows where they are.
5. One undo step per sort. Sorting 10,000 rows takes under 300 ms.

**Acceptance.** Load *Sample 33*. Put `=J2/G2` in `K2` and fill to `K32`. Sort by *Total* descending: `K2` must still show ORD-1025's price per unit (`1080`), `A33` must still read `Total`, and the blank row 19 must sort last among data rows. Filter *Region* to `West` (this must also hide `West ` and `west`, or you must explain why not), then sort by *Units*: hidden rows must not move. Undo twice: original order and no filter. Then load *Sample 3k*, sort by *Date* and show us the time it took.

### C3 — Clipboard engine

Mirrors our clipboard engine: Excel and Google Sheets round-trip, cut-and-paste that moves references.

**Requirements**

1. **Copy** (`Ctrl+C`) writes the selection to the system clipboard as TSV of *computed values* **and** as an HTML table carrying bold/italic/underline/background/colour, so pasting into Sheets or Excel keeps formatting.
2. **Paste** (`Ctrl+V`) accepts multi-row/column TSV from Excel and Sheets, including quoted cells (a cell containing a tab, newline or quote is wrapped in `"…"`, with `""` for a literal quote), and HTML tables from Excel and Sheets with their inline styles. The grid grows when a paste exceeds its bounds (the engine must support growing).
3. **Internal paste** adjusts relative references and keeps absolute ones. Pasting one cell onto a multi-cell selection tiles it. `Ctrl+Shift+V` pastes values only.
4. **Cut** (`Ctrl+X` then `Ctrl+V`) *moves*: the source is cleared, and every formula anywhere that referenced a moved cell is rewritten to its new address. A range reference is rewritten only if both corners moved; cells that were cut but not pasted over are left alone.
5. One undo step per paste or move, styles included. When the browser denies clipboard access, say so and fall back to the `paste` event.
6. **Budget.** Pasting 50,000 cells finishes in under 1 s with the UI responsive. The engine has no batch API and recalculates on every `setCell`: you will have to add one.

**Acceptance.** Load *Sample 33*. Copy `A1:J5` into Google Sheets: bold a header there, copy it back over `A40`, verify values and bold survived both directions. Put `=J2+J3` in `K2`; cut `J2:J3`, paste at `M2`: `K2` must now read `=M2+M3`. Put `=SUM(J2:J32)` in `J34`; cut `J2:J5` and paste elsewhere: `J34` must be unchanged. Paste a 300×200 block from Excel into `A1` of a fresh sheet and undo it once.

### C4 — Formula engine v2

Mirrors our client formula engine (40+ functions). The current parser is a shunting-yard over single-range functions, with a comma that is treated as an operator of undefined precedence.

**Requirements**

1. **Parser rewrite** to a recursive-descent parser producing an AST. Grammar: numbers, strings `"…"` (`""` escapes a quote), `TRUE`/`FALSE`, cell references with optional `$` on either part, ranges, unary minus, `+ - * / ^`, `&` (concatenate), `= <> < > <= >=`, function calls with zero or more comma-separated arguments, arbitrary nesting, whitespace anywhere. Case-insensitive identifiers.
2. **Functions**: `SUM AVERAGE AVG MIN MAX COUNT COUNTA IF AND OR NOT ROUND ABS MOD SUMIF COUNTIF AVERAGEIF VLOOKUP (exact and approximate) INDEX MATCH CONCAT LEFT RIGHT MID LEN UPPER LOWER TRIM IFERROR`. Arguments may be scalars, references or ranges wherever Sheets allows them.
3. **Errors** with Sheets semantics: `#DIV/0!`, `#NAME?`, `#VALUE!`, `#REF!`, `#N/A`, `#CYCLE!`, `#PARSE!`. Errors propagate through arithmetic; `IFERROR` catches; `COUNT` ignores. **Deleting a row or column that a formula points at must produce `#REF!`** (today the reference silently slides onto a neighbour).
4. **Precise dependencies.** A formula over `A1:A100` depends on all hundred cells (today only the two endpoints are tracked). Editing a cell recalculates only its transitive dependents (today a global generation counter invalidates every cell on every edit).
5. **Budget.** A sheet with 20,000 formula cells; editing one input that 10 cells depend on recalculates in under 5 ms; the initial full calculation of those 20,000 cells in under 400 ms.
6. **Formula bar**: autocomplete for function names with a signature hint, and coloured highlighting of referenced ranges in the grid while editing.
7. At least 60 parser/evaluator test cases, including the ones listed here: `=-A1`, `=1-(-1)`, `=2^3^2` (right-associative → 512), `="a"&"b"&1`, `=IF(A1>5,"big","small")`, `=IF(A1,,3)`, `=SUM(A1:A3,B1,10)`, `=SUM()`, `=VLOOKUP("x",A1:B5,2,FALSE)` with no match → `#N/A`, `=1/0` → `#DIV/0!`, `=FOO(1)` → `#NAME?`, `=A1+` → `#PARSE!`, `= 1 + 2 ` (spaces).

**Acceptance.** Load *Sample 33*. `=SUMIF(C2:C32,"West",J2:J32)` in `L1` must equal 15,787.90 once the Region values are trimmed (you decide whether `SUMIF` trims; document it). `=VLOOKUP("ORD-1020",A2:J32,10,FALSE)` returns the first match. Delete column E: formulas pointing at the old E show `#REF!`, formulas pointing at F now point at E. Load *Sample 3k*, fill `K2:K2991` with `=IF(I2="",J2,J2*(1-I2))` and `L2:L2991` with `=COUNTIF($C$2:$C$2991,C2)`, then type into `C2` repeatedly and show us the frame time.

### C5 — Virtualized grid at scale

Mirrors our `CellGrid` + `useVirtualization` + resize hooks. The UI today renders every one of the 2,500 cells on every keystroke and calls `engine.getCell` for each.

**Requirements**

1. A grid of **100,000 rows × 200 columns**. Only visible rows and columns are rendered, plus overscan; row and column offsets are prefix sums searched with binary search; scrolling re-renders at most once per ~10 rows.
2. **Column resize** by dragging the header border, **auto-fit** on double-click (measure the real text), and **row heights**. Widths and heights move with their columns/rows on insert/delete.
3. **Frozen** first row and first column (sticky), scroll-synced with the body.
4. Selection, editing, keyboard navigation (`Ctrl+Home`, `Ctrl+End`, `Page Up/Down`), a *name box* that jumps to `AZ5000`, and the formula bar all stay correct while scrolled far away from the origin.
5. **Budgets** (production build): first paint under 100 ms; scrolling holds 60 fps; keystroke latency under 16 ms with 50,000 filled cells; no React state per cell. You will need memoised cells with a cheap "has this cell changed" signal from the engine, and you will have to stop the engine from recomputing every cell on every edit (see C4 point 4; you only need enough of that fix to meet the budget).

**Acceptance.** Load *Sample 3k*, then fill `K2` = `=J2*2` down to row 100,000 with your own loop (document how). Scroll to row 95,000 with the devtools performance panel recording, type into `J95000`, and show us the commit count and frame time. Freeze row 1, resize column D to 300 px, insert a column before D, verify the new column has the default width and the old D kept 300 px.

### C6 — Conditional formatting

Mirrors our rule engine: rules are tried in priority order and the first match styles the cell.

**Requirements**

1. A rules panel: add, edit, delete, reorder. A rule has one or more ranges, a condition and a style. Conditions: greater than, less than, between, equal to, text contains, text starts with, is empty, **custom formula** (written for the top-left cell of the first range; relative references shift per cell, `$` pins) and a two-colour **colour scale** over the range's computed numbers.
2. Conditions read **computed** values. Rule styles layer over manual styles (rule wins). First matching rule wins; later rules are not merged.
3. Rule ranges shift with insert/delete row/column. Adding, editing and removing a rule are undo steps.
4. **Budget.** A custom-formula rule over 10,000 cells: parse the formula once per rule, evaluate once per cell, cache results and invalidate only when a dependency changes. Keystroke latency with that rule active stays under 50 ms.

**Acceptance.** Load *Sample 33*. Rule 1: `J2:J32` greater than 5000 → green. Rule 2: custom formula `=$I2=""` over `A2:J32` → yellow row. Rule 3: colour scale on `G2:G32`. Change `J7` to `100` and the green must disappear immediately. Delete row 19 and verify rule 2 still highlights the right rows. Explain in your notes which rule wins on `J18` and why. Then load *Sample 3k*, apply the same three rules over the full data and show us the keystroke latency.

---

## AI track (choose at least one)

Both tasks follow one principle, taken from our product: **the model translates, the engine computes.** The model turns natural language into a small, validated JSON action; your code executes it deterministically. No number a user sees may come out of the model.

### Shared requirements

- **Provider abstraction.** `src/ai/provider.js` defines the interface and ships a deterministic **mock** that answers the prompts in `fixtures/ai-eval/`. Implement the **http** provider against **any LLM API you choose** with plain `fetch` (endpoint, key and model from `.env.local`; see `.env.example`). Nothing outside `provider.js` may know which vendor you picked. Never commit a key.
- **Contract.** Actions and their JSON Schemas are in `src/ai/contract.js`; semantics in `AI_CONTRACT.md`. Validate every model response against the schema **before** anything touches the sheet. Write the validator yourself (it is small). A response that is not valid JSON, or does not validate, produces a visible error and changes nothing.
- **Response parsing.** Models wrap JSON in prose and code fences; the mock does too, on purpose. Handle it.
- **Context sent to the model**: column headers, an inferred type per column (`number`, `currency`, `percent`, `date`, `text`, `id`), five sample rows, the row count, and the current selection. **Never the full data.** Document the exact context shape you send.
- **Panel.** `Ctrl+K` opens a side panel: prompt input, conversation history, result cards, and the raw action JSON behind every result on demand (a "show plan" toggle). Errors from the provider (network, auth, rate limit) are shown, never swallowed.
- **Golden sets are the truth.** `fixtures/ai-eval/queries.json` (computed over *Sample 3k*) and `fixtures/ai-eval/format-prompts.json` (over *Sample 33*) hold, for every prompt, the action the mock returns and the result that must come out. Graders type those prompts into your panel, in mock mode and then with a live key, and compare. Your recording must show at least eight of the query prompts and five of the format prompts, with the plan/action visible.
- **Scale.** The AI features are judged on the 3,000-row sample. The executor and the applier must stay pure functions over the engine's data (no React), so they are testable and would move to a backend unchanged if you add one.

### A1 — Format with AI

Mirrors our `format_sheet` action. "Format this as a clean table" becomes a `format_sheet` action, which you apply through the existing style system.

**Requirements**

1. **Flow.** Prompt → action → a **preview** of what will change in plain words ("header: bold, grey; 4 columns: number formats; freeze 1 row; totals row: bold") → *Apply* → **one** undo step → *Discard*.
2. **New display features the action needs** (none exist today):
   - `numberFormat` as a cell style: `number` (thousands separators, 2 decimals), `currency` (`$1,200.00`), `percent` (`10%`; raw `0.1` and raw `10%` both display `10%`), `date` (the three input formats in the sample all display as `2024-01-15`). Formatting never changes the stored value; non-numeric text is left alone.
   - **Freeze rows** (sticky header rows), **column widths** with **auto-fit**.
3. **Applying an action** (see `AI_CONTRACT.md` for the exact rules): row 1 is the header; the body is row 2 to the last used row; the last row gets `totalsStyle` **only if it looks like a totals row** (label like "Total" in its first filled cell, or label-then-numbers with gaps) — otherwise the style is dropped; `clearFormatting` runs first; header style is applied last so it wins over column styles; the header row is never number-formatted; column indices from the model are clamped to the used range and never widen the sheet; `freezeRows: 0` unfreezes and `null`/absent means "not mentioned"; an action that changes nothing reports `NO_CHANGES` and adds no undo entry; out-of-range requests report `OUT_OF_RANGE` and change nothing.
4. **Styles survive structure changes.** The style store is keyed `row,col` and is not shifted on insert/delete today. Fix that, with undo.

**Golden set.** `fixtures/ai-eval/format-prompts.json` — ten prompts over *Sample 33*, each with the action the mock returns and the checks that must hold afterwards. Then show the same prompts on *Sample 3k*: the totals row is row 2,992 there and the result must be just as correct, and applied in under 300 ms.

**Stretch.** "Format like the selection" (derive a style action from the selected range); multi-turn ("now make it green").

### A2 — Ask your data

Mirrors our analysis tool: a question becomes a read-only `query` plan, executed by your code over the sheet's computed values.

**Requirements**

1. **Flow.** Prompt → plan → validate → execute → a result card with: a table, the row count, a plain-words description of the plan plus its JSON on demand, **Re-run** (executes the stored plan again with no model call and must reproduce the result), and **Insert into sheet** (writes the result as values at a cell the user picks, one undo step). A `clarify` action shows the model's question.
2. **Executor** (pure, no React), implementing exactly the semantics in `AI_CONTRACT.md`: header row, blank rows skipped, totals row excluded by default, text normalisation (trim, case-insensitive), number coercion (`$1,200.00` → 1200, `10%` → 0.1, `0.1` → 0.1, `N/A` → not a number), date parsing for the three sample formats, filters combined with AND, group-by on normalised keys with the first-seen label, aggregates, multi-key stable sort, limit capped at 500.
3. **Guardrails.** Read-only: any non-`query` action is rejected before execution. An unknown column is an error that **asks the user** rather than guessing. The limit cap is enforced in code, never trusted from the plan.
4. **Budget.** Any golden plan over the 3,000-row sample executes in under 50 ms; a two-level group-by over 100,000 rows (generate them yourself) in under 500 ms. The panel stays responsive while a query runs.

**Golden set.** `fixtures/ai-eval/queries.json` — twenty prompts over *Sample 3k* (seventeen answers, three that must be refused) with the plan the mock returns and the result your executor must produce.

**Stretch.** Multi-turn refinement ("top 3 of that" operates on the previous result); "chart it" as an inline SVG bar chart; a one-sentence phrasing of the result by the model where every number in the sentence is checked against the executor's result before display.

---

## What we grade

| Criterion | Weight | What it means in practice |
|---|---|---|
| Correctness against acceptance checks and golden sets | 30% | We run them by hand on your production build and check your recording against the golden sets. |
| Codebase understanding | 20% | Defects found and explained; features built on the engine's patterns rather than around them; engine kept pure. |
| Design and code quality | 20% | Clear data model, documented engine API, sensible undo semantics, readable code, no dead paths. |
| Tests and measured budgets | 15% | Meaningful tests; numbers you measured, with how you measured them. |
| Live walkthrough | 15% | You explain your choices and extend your own code on the spot. |

What loses points fastest: silent failures, numbers that come from a model, undo that half-works, an engine that imports React, a feature that only works on tidy data.

---

## Submission

1. Fork the repository. One branch per task: `task-0-warmup`, `task-c2-sort-filter`, `task-a2-ask-data`, and so on. Open one pull request per task.
2. Add `DESIGN_NOTES.md` at the repo root (a template is provided). Required sections: data model changes, engine API you added, undo semantics per action, defects you found with root causes, measurements with method, what you would do next.
3. Attach a screen recording per task (ten minutes at most) in which you run the task's acceptance checks on the sample data and explain, in your own words, how the code works. For an AI task, show the golden prompts (see the AI track) with the plan visible. We watch these before the walkthrough.
4. Make sure `npm run lint`, `npm run build` and `npm test` pass on each branch. If you added a backend, `npm run server` must start it.

We reply within a few days to schedule the walkthrough.
