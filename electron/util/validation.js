// Parses a positive numeric amount and returns the coerced number. Throws the
// caller-supplied message so each call site keeps its own error text.
export function parsePositiveAmount(amount, message) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) throw new Error(message)
  return value
}
