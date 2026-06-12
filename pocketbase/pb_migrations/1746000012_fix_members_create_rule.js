/// <reference path="../pb_data/types.d.ts" />
// Fix: members.createRule was "@request.auth.id != ''"  - any authenticated user could
// self-insert as admin. Member creation now exclusively happens through server-side hooks
// (POST /api/household/complete-setup for first admin, POST /api/accept-invite for invitees).
migrate((app) => {
  const members = app.findCollectionByNameOrId("members")
  members.createRule = null
  app.save(members)
}, (app) => {
  const members = app.findCollectionByNameOrId("members")
  members.createRule = "@request.auth.id != ''"
  app.save(members)
})
