import { shiftFormulaReferences } from './references.js'

export function fillNumericSeries(
first,
second,
count
) {
if (!Number.isInteger(count) || count < 0) {
throw new Error('Invalid fill count')
}

const step = second - first

return Array.from(
{ length: count },
(_, index) => second + step * (index + 1)
)
}

export function incrementTextSuffix(
text,
increment
) {
const match = String(text).match(/^(.*?)(\d+)$/)

if (!match) return text

const prefix = match[1]
const numberText = match[2]

const nextNumber =
Number(numberText) + increment

const paddedNumber = String(nextNumber).padStart(
numberText.length,
'0'
)

return prefix + paddedNumber
}

export function fillFormula(
formula,
sourceRow,
sourceColumn,
targetRow,
targetColumn
) {
return shiftFormulaReferences(
formula,
targetRow - sourceRow,
targetColumn - sourceColumn
)
}