/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "type": "base",
    "name": "households",
    "listRule": "@request.auth.household_id = id",
    "viewRule": "@request.auth.household_id = id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "@request.auth.household_id = id && @request.auth.members_via_user_id.role ?= 'admin'",
    "deleteRule": "@request.auth.household_id = id && @request.auth.members_via_user_id.role ?= 'admin'",
    "fields": [
      { "name": "name", "type": "text", "required": true },
      { "name": "currency", "type": "text", "required": false },
      { "name": "split_ratios", "type": "json", "required": false },
      { "name": "reminder_day", "type": "text", "required": false }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("households")
  return app.delete(collection)
})
