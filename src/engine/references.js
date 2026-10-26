export function columnToIndex(label) {
let result = 0

for (const char of label.toUpperCase()) {
result = result * 26 + char.charCodeAt(0) - 64
}

return result - 1
}

export function indexToColumn(index) {
if (!Number.isInteger(index) || index < 0) {
throw new Error('Invalid column index')
}

let result = ''
let value = index + 1

while (value > 0) {
value--

result =
String.fromCharCode(65 + (value % 26)) +
result

value = Math.floor(value / 26)
}

return result
}

export function shiftFormulaReferences(
formula,
rowOffset,
columnOffset
) {
if (typeof formula !== 'string' || !formula.startsWith('=')) {
return formula
}

return formula.replace(
/(\$?)([A-Z]+)(\$?)([1-9]\d*)/gi,
(match, absoluteColumn, column, absoluteRow, row) => {
const originalColumn = columnToIndex(column)
const originalRow = Number(row) - 1

const nextColumn = absoluteColumn
? originalColumn
: originalColumn + columnOffset

const nextRow = absoluteRow
? originalRow
: originalRow + rowOffset

if (nextColumn < 0 || nextRow < 0) {
return '#REF!'
}

return (
absoluteColumn +
indexToColumn(nextColumn) +
absoluteRow +
String(nextRow + 1)
)
}
)
}