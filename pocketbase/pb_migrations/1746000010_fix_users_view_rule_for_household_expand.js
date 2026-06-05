/// <reference path="../pb_data/types.d.ts" />
// Fix: _pb_users_auth_ defaulted to viewRule "@request.auth.id = id", which caused
// expand: 'user_id' on members queries to silently return no data for other users,
// showing "Unknown member" for every household-mate. Allow viewing a user record
// if the requester shares a household with that user.
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  users.listRule = "@request.auth.id = id || @request.auth.members_via_user_id.household_id ?= members_via_user_id.household_id"
  users.viewRule = "@request.auth.id = id || @request.auth.members_via_user_id.household_id ?= members_via_user_id.household_id"
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  users.listRule = "@request.auth.id = id"
  users.viewRule = "@request.auth.id = id"
  app.save(users)
})
