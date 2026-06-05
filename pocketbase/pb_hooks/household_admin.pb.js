/// DELETE /api/household — Sole-member admin deletes entire household and all data
routerAdd('DELETE', '/api/household', (e) => {
  try {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Unauthorized' })
    }
    const userId = authRecord.id

    // Find user's member record
    const memberRecords = $app.findRecordsByFilter(
      'members',
      'user_id = {:userId}',
      '', 1, 0, { userId }
    )
    if (memberRecords.length === 0) {
      return e.json(404, { message: 'Not a member of any household' })
    }
    const callerMember = memberRecords[0]
    const householdId = callerMember.get('household_id')

    // Must be admin
    if (callerMember.get('role') !== 'admin') {
      return e.json(403, { message: 'Admin only' })
    }

    // Must be sole remaining member (limit 2 — we only need to know if count is exactly 1)
    const allMembers = $app.findRecordsByFilter(
      'members',
      'household_id = {:hid}',
      '', 2, 0, { hid: householdId }
    )
    if (allMembers.length !== 1) {
      return e.json(403, { message: 'Only the sole remaining member can delete the household' })
    }

    // Fetch all records to delete before opening the transaction (reads outside, writes atomic)
    const notifications = $app.findRecordsByFilter(
      'notifications', 'household_id = {:hid}', '', 500, 0, { hid: householdId }
    )
    const groceryItems = $app.findRecordsByFilter(
      'grocery_items', 'household_id = {:hid}', '', 500, 0, { hid: householdId }
    )
    const meals = $app.findRecordsByFilter(
      'meals', 'household_id = {:hid}', '', 500, 0, { hid: householdId }
    )
    const ingredients = []
    for (const meal of meals) {
      const mealIngredients = $app.findRecordsByFilter(
        'ingredients', 'meal_id = {:mid}', '', 500, 0, { mid: meal.id }
      )
      for (const r of mealIngredients) { ingredients.push(r) }
    }
    const expenses = $app.findRecordsByFilter(
      'expenses', 'household_id = {:hid}', '', 500, 0, { hid: householdId }
    )
    const invitations = $app.findRecordsByFilter(
      'invitations', 'household_id = {:hid}', '', 500, 0, { hid: householdId }
    )
    const household = $app.findRecordById('households', householdId)

    // Delete in dependency order inside a transaction — any failure rolls back everything
    $app.runInTransaction((txApp) => {
      // 1. notifications
      for (const r of notifications) { txApp.delete(r) }
      // 2. grocery_items
      for (const r of groceryItems) { txApp.delete(r) }
      // 3. ingredients (must precede meals due to FK)
      for (const r of ingredients) { txApp.delete(r) }
      // 4. meals
      for (const meal of meals) { txApp.delete(meal) }
      // 5. expenses
      for (const r of expenses) { txApp.delete(r) }
      // 6. invitations
      for (const r of invitations) { txApp.delete(r) }
      // 7. members (only the caller at this point)
      for (const r of allMembers) { txApp.delete(r) }
      // 8. household
      txApp.delete(household)
    })

    return e.json(200, { message: 'Household deleted' })
  } catch (err) {
    console.error('[delete-household] error:', err)
    return e.json(500, { message: 'Server error during deletion' })
  }
})
