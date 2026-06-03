/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const householdsId = app.findCollectionByNameOrId("households").id

  const collection = new Collection({
    "type": "base",
    "name": "invitations",
    "listRule": "@request.auth.members_via_user_id.household_id ?= household_id && @request.auth.members_via_user_id.role ?= 'admin'",
    "viewRule": "@request.auth.members_via_user_id.household_id ?= household_id && @request.auth.members_via_user_id.role ?= 'admin'",
    "createRule": "@request.auth.members_via_user_id.household_id ?= household_id && @request.auth.members_via_user_id.role ?= 'admin'",
    "updateRule": null,
    "deleteRule": "@request.auth.members_via_user_id.household_id ?= household_id && @request.auth.members_via_user_id.role ?= 'admin'",
    "fields": [
      {
        "name": "household_id",
        "type": "relation",
        "required": true,
        "collectionId": householdsId,
        "maxSelect": 1,
        "cascadeDelete": true
      },
      {
        "name": "invited_email",
        "type": "text",
        "required": true
      },
      {
        "name": "accepted",
        "type": "bool",
        "required": false
      }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("invitations")
  return app.delete(collection)
})
