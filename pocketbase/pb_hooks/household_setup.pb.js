/// <reference path="../pb_data/types.d.ts" />

/// POST /api/household/complete-setup
/// Creates the first admin member record for the authenticated user.
/// Called by HouseholdSetupView after creating the household.
/// members.createRule = null, so direct SDK creation is blocked  - this hook is the only path.
routerAdd('POST', '/api/household/complete-setup', (e) => {
  try {
    const body = e.requestInfo().body
    const householdId = body['household_id']
    if (!householdId) {
      return e.json(400, { message: 'household_id is required' })
    }

    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Unauthorized' })
    }
    const userId = authRecord.id

    // Guard: household must exist
    $app.findRecordById('households', householdId) // throws if not found

    // Guard: household must have no members yet (first-admin path only)
    const existing = $app.findRecordsByFilter(
      'members',
      'household_id = {:householdId}',
      '', 1, 0,
      { householdId }
    )
    if (existing.length > 0) {
      return e.json(409, { message: 'Household already has members' })
    }

    const membersCol = $app.findCollectionByNameOrId('members')
    const member = new Record(membersCol)
    member.set('household_id', householdId)
    member.set('user_id', userId)
    member.set('role', 'admin')
    $app.save(member)

    return e.json(200, { memberId: member.id })
  } catch (err) {
    console.error('[household-setup POST] error:', err)
    return e.json(500, { message: 'Server error' })
  }
})
