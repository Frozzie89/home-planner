/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const mealsId = app.findCollectionByNameOrId("meals").id

  const collection = new Collection({
    "type": "base",
    "name": "ingredients",
    "listRule": "meal_id.household_id = @request.auth.household_id",
    "viewRule": "meal_id.household_id = @request.auth.household_id",
    "createRule": "meal_id.household_id = @request.auth.household_id",
    "updateRule": "meal_id.household_id = @request.auth.household_id",
    "deleteRule": "meal_id.household_id = @request.auth.household_id",
    "fields": [
      {
        "name": "meal_id",
        "type": "relation",
        "required": true,
        "collectionId": mealsId,
        "maxSelect": 1,
        "cascadeDelete": true
      },
      { "name": "name", "type": "text", "required": true },
      { "name": "quantity", "type": "number", "required": true },
      { "name": "unit", "type": "text", "required": true }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("ingredients")
  return app.delete(collection)
})
