/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const members = app.findCollectionByNameOrId("members")
  members.fields.add(new Field({
    name: "display_name",
    type: "text",
    required: false,
    max: 64
  }))
  members.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id && (@request.auth.id = user_id || @request.auth.members_via_user_id.role ?= 'admin')"
  app.save(members)
}, (app) => {
  const members = app.findCollectionByNameOrId("members")
  const field = members.fields.getByName("display_name")
  if (field) members.fields.remove(field)
  members.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id && @request.auth.members_via_user_id.role ?= 'admin'"
  app.save(members)
})
