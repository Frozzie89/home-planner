/// <reference path="../pb_data/types.d.ts" />
// Add minimum constraint to expenses.amount: 1 cent minimum prevents zero-amount records.
// Amount is stored as integer cents (ARC-04: e.g. 4580 = €45.80).
migrate((app) => {
  const expenses = app.findCollectionByNameOrId("expenses")
  const amountField = expenses.fields.getByName("amount")
  amountField.min = 1
  app.save(expenses)
}, (app) => {
  const expenses = app.findCollectionByNameOrId("expenses")
  const amountField = expenses.fields.getByName("amount")
  amountField.min = null
  app.save(expenses)
})
