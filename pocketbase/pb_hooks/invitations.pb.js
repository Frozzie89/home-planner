/// Handler A — auto-generate token before an invitation record is created
onRecordCreate((e) => {
  if (e.record.collection().name !== 'invitations') {
    return e.next()
  }
  try {
    e.record.set(
      'token',
      $security.randomStringWithAlphabet(
        32,
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      )
    )
  } catch (err) {
    console.error('[invitations hook] token generation error:', err)
    throw err
  }
  return e.next()
})

/// Handler B — GET /api/invite/{token}  (public — no auth required)
routerAdd('GET', '/api/invite/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    const invites = $app.findRecordsByFilter(
      'invitations',
      'token = {:token} && accepted = false',
      '',
      1,
      0,
      { token }
    )
    if (invites.length === 0) {
      return e.json(404, { message: 'Not found' })
    }
    const invite = invites[0]
    const household = $app.findRecordById('households', invite.get('household_id'))
    return e.json(200, { householdName: household.get('name') })
  } catch (err) {
    console.error('[invite GET] error:', err)
    return e.json(500, { message: 'Server error' })
  }
})

/// Handler C — POST /api/accept-invite  (requires authenticated user)
routerAdd('POST', '/api/accept-invite', (e) => {
  try {
    const token = e.requestInfo().body['token']
    if (!token) {
      return e.json(400, { message: 'Token is required' })
    }

    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Unauthorized' })
    }
    const userId = authRecord.id

    const invites = $app.findRecordsByFilter(
      'invitations',
      'token = {:token} && accepted = false',
      '',
      1,
      0,
      { token }
    )
    if (invites.length === 0) {
      return e.json(404, { message: 'Invalid or already accepted invitation' })
    }
    const invite = invites[0]
    const householdId = invite.get('household_id')

    // Guard: user must not already be a member of this household
    const existingMembers = $app.findRecordsByFilter(
      'members',
      'user_id = {:userId} && household_id = {:householdId}',
      '',
      1,
      0,
      { userId, householdId }
    )
    if (existingMembers.length > 0) {
      return e.json(409, { message: 'Already a member of this household' })
    }

    // Create member record and mark invitation accepted
    const membersCol = $app.findCollectionByNameOrId('members')
    const member = new Record(membersCol)
    member.set('household_id', householdId)
    member.set('user_id', userId)
    member.set('role', 'member')

    $app.save(member)

    invite.set('accepted', true)
    $app.save(invite)

    return e.json(200, { message: 'Welcome to the household' })
  } catch (err) {
    console.error('[accept-invite POST] error:', err)
    return e.json(500, { message: 'Server error' })
  }
})
