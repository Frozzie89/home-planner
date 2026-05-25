/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const householdsId = app.findCollectionByNameOrId("households").id
  const membersId = app.findCollectionByNameOrId("members").id

  const collection = new Collection({
    "type": "base",
    "name": "expenses",
    "listRule": "household_id = @request.auth.household_id",
    "viewRule": "household_id = @request.auth.household_id",
    "createRule": "household_id = @request.auth.household_id && member_id.household_id = @request.auth.household_id",
    "updateRule": "household_id = @request.auth.household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')",
    "deleteRule": "household_id = @request.auth.household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')",
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
        "name": "member_id",
        "type": "relation",
        "required": true,
        "collectionId": membersId,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      { "name": "title", "type": "text", "required": true },
      { "name": "amount", "type": "number", "required": true, "noDecimal": true },
      { "name": "portion", "type": "number", "required": true, "noDecimal": true },
      { "name": "date", "type": "date", "required": true }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("expenses")
  return app.delete(collection)
})
