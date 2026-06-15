/// <reference path="../pb_data/types.d.ts" />
// Fix settlements collection API rules: replace @request.auth.household_id (never populated)
// with the membership-via-reverse-relation pattern used by all other collections.
migrate((app) => {
  const settlements = app.findCollectionByNameOrId("settlements")
  settlements.listRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  settlements.viewRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  settlements.createRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  // updateRule and deleteRule remain null — settlements are immutable
  app.save(settlements)
}, (app) => {
  const settlements = app.findCollectionByNameOrId("settlements")
  settlements.listRule   = "household_id = @request.auth.household_id"
  settlements.viewRule   = "household_id = @request.auth.household_id"
  settlements.createRule = "household_id = @request.auth.household_id && member_a_id.household_id = @request.auth.household_id && member_b_id.household_id = @request.auth.household_id"
  app.save(settlements)
})
