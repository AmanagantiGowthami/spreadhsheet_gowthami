# Design notes

Fill this in as you work. Keep it factual and short; bullet points are fine. Graders read this before your code.

## Challenges

- Challenge N — notes

## Data model changes

What you added to or changed in the engine's state, and why. (Row identity? style store? number formats? rules?)

## Engine API

Every method you added to the object returned by `createEngine`, one line each: signature, what it does, what one undo reverts.

## Undo semantics

For each user action you added: what a single `Ctrl+Z` reverts.

## Defects found in the existing code

For each: where, symptom, root cause (two or three sentences), fix.

## Measurements

What you measured, how (production build? which machine? how many runs?), the numbers.

## AI (if applicable)

- Provider you wired up and why.
- Exact context shape sent to the model.
- How you parse and validate responses; what happens on each failure.
- Anything the golden set disagrees with your implementation on, and why you chose your behaviour.

## Trade-offs and what you would do next

## Use of AI tools

Which tools you used and for what. Nothing here counts against you; we just want to know.
