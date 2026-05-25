/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const householdsId = app.findCollectionByNameOrId("households").id

  const collection = new Collection({
    "type": "base",
    "name": "members",
    "listRule": "household_id = @request.auth.household_id",
    "viewRule": "household_id = @request.auth.household_id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "household_id = @request.auth.household_id && @request.auth.members_via_user_id.role ?= 'admin'",
    "deleteRule": "household_id = @request.auth.household_id && @request.auth.members_via_user_id.role ?= 'admin'",
    "fields": [
      {
        "name": "household_id",
        "type": "relation",
        "required": true,
        "collectionId": householdsId,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      {
        "name": "user_id",
        "type": "relation",
        "required": true,
        "collectionId": "_pb_users_auth_",
        "maxSelect": 1,
        "cascadeDelete": true
      },
      {
        "name": "role",
        "type": "select",
        "required": true,
        "values": ["member", "admin"],
        "maxSelect": 1
      }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("members")
  return app.delete(collection)
})
