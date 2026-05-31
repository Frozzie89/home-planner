/// <reference path="../pb_data/types.d.ts" />
// Fix: all collections used @request.auth.household_id which references a field on the
// users record that is never written by the app. Replace with membership checks via the
// members_via_user_id reverse relation, which is always authoritative.
migrate((app) => {
  // --- households ---
  const households = app.findCollectionByNameOrId("households")
  households.listRule   = "@request.auth.members_via_user_id.household_id ?= id"
  households.viewRule   = "@request.auth.members_via_user_id.household_id ?= id"
  // createRule unchanged: "@request.auth.id != ''"
  households.updateRule = "@request.auth.members_via_user_id.household_id ?= id && @request.auth.members_via_user_id.role ?= 'admin'"
  households.deleteRule = "@request.auth.members_via_user_id.household_id ?= id && @request.auth.members_via_user_id.role ?= 'admin'"
  app.save(households)

  // --- members ---
  const members = app.findCollectionByNameOrId("members")
  members.listRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  members.viewRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  // createRule unchanged: "@request.auth.id != ''"
  members.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id && @request.auth.members_via_user_id.role ?= 'admin'"
  members.deleteRule = "@request.auth.members_via_user_id.household_id ?= household_id && @request.auth.members_via_user_id.role ?= 'admin'"
  app.save(members)

  // --- expenses ---
  const expenses = app.findCollectionByNameOrId("expenses")
  expenses.listRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  expenses.viewRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  expenses.createRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  expenses.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  expenses.deleteRule = "@request.auth.members_via_user_id.household_id ?= household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  app.save(expenses)

  // --- meals ---
  const meals = app.findCollectionByNameOrId("meals")
  meals.listRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  meals.viewRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  meals.createRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  meals.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  meals.deleteRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  app.save(meals)

  // --- ingredients (accessed via meal_id relation) ---
  const ingredients = app.findCollectionByNameOrId("ingredients")
  ingredients.listRule   = "@request.auth.members_via_user_id.household_id ?= meal_id.household_id"
  ingredients.viewRule   = "@request.auth.members_via_user_id.household_id ?= meal_id.household_id"
  ingredients.createRule = "@request.auth.members_via_user_id.household_id ?= meal_id.household_id"
  ingredients.updateRule = "@request.auth.members_via_user_id.household_id ?= meal_id.household_id"
  ingredients.deleteRule = "@request.auth.members_via_user_id.household_id ?= meal_id.household_id"
  app.save(ingredients)

  // --- grocery_items ---
  const groceryItems = app.findCollectionByNameOrId("grocery_items")
  groceryItems.listRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  groceryItems.viewRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  // createRule stays null (public write)
  groceryItems.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  // deleteRule stays null
  app.save(groceryItems)

  // --- notifications ---
  const notifications = app.findCollectionByNameOrId("notifications")
  notifications.listRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  notifications.viewRule   = "@request.auth.members_via_user_id.household_id ?= household_id"
  // createRule stays null
  notifications.updateRule = "@request.auth.members_via_user_id.household_id ?= household_id"
  // deleteRule stays null
  app.save(notifications)

}, (app) => {
  // Rollback: restore original (broken) rules so the migration can be cleanly reverted
  const households = app.findCollectionByNameOrId("households")
  households.listRule   = "@request.auth.household_id = id"
  households.viewRule   = "@request.auth.household_id = id"
  households.updateRule = "@request.auth.household_id = id && @request.auth.members_via_user_id.role ?= 'admin'"
  households.deleteRule = "@request.auth.household_id = id && @request.auth.members_via_user_id.role ?= 'admin'"
  app.save(households)

  const members = app.findCollectionByNameOrId("members")
  members.listRule   = "household_id = @request.auth.household_id"
  members.viewRule   = "household_id = @request.auth.household_id"
  members.updateRule = "household_id = @request.auth.household_id && @request.auth.members_via_user_id.role ?= 'admin'"
  members.deleteRule = "household_id = @request.auth.household_id && @request.auth.members_via_user_id.role ?= 'admin'"
  app.save(members)

  const expenses = app.findCollectionByNameOrId("expenses")
  expenses.listRule   = "household_id = @request.auth.household_id"
  expenses.viewRule   = "household_id = @request.auth.household_id"
  expenses.createRule = "household_id = @request.auth.household_id && member_id.household_id = @request.auth.household_id"
  expenses.updateRule = "household_id = @request.auth.household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  expenses.deleteRule = "household_id = @request.auth.household_id && (member_id.user_id = @request.auth.id || @request.auth.members_via_user_id.role ?= 'admin')"
  app.save(expenses)

  const meals = app.findCollectionByNameOrId("meals")
  meals.listRule   = "household_id = @request.auth.household_id"
  meals.viewRule   = "household_id = @request.auth.household_id"
  meals.createRule = "household_id = @request.auth.household_id"
  meals.updateRule = "household_id = @request.auth.household_id"
  meals.deleteRule = "household_id = @request.auth.household_id"
  app.save(meals)

  const ingredients = app.findCollectionByNameOrId("ingredients")
  ingredients.listRule   = "meal_id.household_id = @request.auth.household_id"
  ingredients.viewRule   = "meal_id.household_id = @request.auth.household_id"
  ingredients.createRule = "meal_id.household_id = @request.auth.household_id"
  ingredients.updateRule = "meal_id.household_id = @request.auth.household_id"
  ingredients.deleteRule = "meal_id.household_id = @request.auth.household_id"
  app.save(ingredients)

  const groceryItems = app.findCollectionByNameOrId("grocery_items")
  groceryItems.listRule   = "household_id = @request.auth.household_id"
  groceryItems.viewRule   = "household_id = @request.auth.household_id"
  groceryItems.updateRule = "household_id = @request.auth.household_id"
  app.save(groceryItems)

  const notifications = app.findCollectionByNameOrId("notifications")
  notifications.listRule   = "household_id = @request.auth.household_id"
  notifications.viewRule   = "household_id = @request.auth.household_id"
  notifications.updateRule = "household_id = @request.auth.household_id"
  app.save(notifications)
})
