/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const householdsId = app.findCollectionByNameOrId("households").id

  const collection = new Collection({
    "type": "base",
    "name": "meals",
    "listRule": "household_id = @request.auth.household_id",
    "viewRule": "household_id = @request.auth.household_id",
    "createRule": "household_id = @request.auth.household_id",
    "updateRule": "household_id = @request.auth.household_id",
    "deleteRule": "household_id = @request.auth.household_id",
    "fields": [
      {
        "name": "household_id",
        "type": "relation",
        "required": true,
        "collectionId": householdsId,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      { "name": "day", "type": "date", "required": true },
      { "name": "name", "type": "text", "required": true }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("meals")
  return app.delete(collection)
})
