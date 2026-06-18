/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const householdsId = app.findCollectionByNameOrId("households").id
  const membersId = app.findCollectionByNameOrId("members").id

  const collection = new Collection({
    "type": "base",
    "name": "settlements",
    "listRule": "household_id = @request.auth.household_id",
    "viewRule": "household_id = @request.auth.household_id",
    "createRule": "household_id = @request.auth.household_id && member_a_id.household_id = @request.auth.household_id && member_b_id.household_id = @request.auth.household_id",
    "updateRule": null,
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
      {
        "name": "member_a_id",
        "type": "relation",
        "required": true,
        "collectionId": membersId,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      {
        "name": "member_b_id",
        "type": "relation",
        "required": true,
        "collectionId": membersId,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      {
        "name": "settled_at",
        "type": "date",
        "required": true
      }
    ]
  })
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("settlements")
  return app.delete(collection)
})
