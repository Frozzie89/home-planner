/// <reference path="../pb_data/types.d.ts" />
// Re-apply correct API rules for the expenses collection.
// Migration 1746000008 may have saved households/members but failed before saving expenses,
// leaving expenses with the old broken listRule "household_id = @request.auth.household_id"
// where @request.auth.household_id is never populated, causing every list request to 400.
migrate((app) => {
  const expenses = app.findCollectionByNameOrId("expenses")
  expenses.listRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  expenses.viewRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  expenses.createRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  expenses.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  expenses.deleteRule = "@request.auth.members_via_user_id.household_id ?= household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  app.save(expenses)
}, (app) => {
  const expenses = app.findCollectionByNameOrId("expenses")
  expenses.listRule   = "household_id = @request.auth.household_id"
  expenses.viewRule   = "household_id = @request.auth.household_id"
  expenses.createRule = "household_id = @request.auth.household_id && member_id.household_id = @request.auth.household_id"
  expenses.updateRule = "household_id = @request.auth.household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  expenses.deleteRule = "household_id = @request.auth.household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  app.save(expenses)
})
