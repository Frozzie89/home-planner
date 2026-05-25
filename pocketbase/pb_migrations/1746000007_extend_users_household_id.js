/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("_pb_users_auth_")
  const householdsId = app.findCollectionByNameOrId("households").id

  usersCollection.fields.add(new Field({
    "name": "household_id",
    "type": "relation",
    "required": false,
    "collectionId": householdsId,
    "maxSelect": 1,
    "cascadeDelete": false
  }))
  return app.save(usersCollection)
}, (app) => {
  const usersCollection = app.findCollectionByNameOrId("_pb_users_auth_")
  const field = usersCollection.fields.getByName("household_id")
  if (field) usersCollection.fields.remove(field)
  return app.save(usersCollection)
})
