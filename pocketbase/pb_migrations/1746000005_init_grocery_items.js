/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const householdsId = app.findCollectionByNameOrId("households").id
  const mealsId = app.findCollectionByNameOrId("meals").id

  const collection = new Collection({
    "type": "base",
    "name": "grocery_items",
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
      { "name": "name", "type": "text", "required": true },
      { "name": "quantity", "type": "number", "required": false },
      { "name": "unit", "type": "text", "required": false },
      { "name": "checked", "type": "bool", "required": false },
      {
        "name": "meal_id",
        "type": "relation",
        "required": false,
        "collectionId": mealsId,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      { "name": "week_start", "type": "date", "required": true }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("grocery_items")
  return app.delete(collection)
})
