/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const householdsId = app.findCollectionByNameOrId("households").id

  const collection = new Collection({
    "type": "base",
    "name": "notifications",
    "listRule": "household_id = @request.auth.household_id",
    "viewRule": "household_id = @request.auth.household_id",
    "createRule": null,
    "updateRule": "household_id = @request.auth.household_id",
    "deleteRule": null,
    "fields": [
      {
        "name": "household_id",
        "type": "relation",
        "required": true,
        "collectionId": householdsId,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      { "name": "type", "type": "text", "required": true },
      { "name": "read", "type": "bool", "required": false }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("notifications")
  return app.delete(collection)
})
