// Auto-join household on OAuth2 login when a pending invitation exists for the user's email.
onRecordAfterAuthWithOAuth2Request((e) => {
  const userId = e.record.id
  // Normalize to lowercase — OAuth2 providers may return mixed-case emails
  const userEmail = (e.record.email || '').toLowerCase()
  if (!userEmail) return

  try {
    // Check if user already has a member record (not their first OAuth2 login or was re-invited)
    const existingMembers = $app.findRecordsByFilter(
      'members',
      'user_id = {:userId}',
      '',
      1,
      0,
      { userId: userId }
    )
    if (existingMembers.length > 0) return // already in a household — nothing to do

    // Check for a pending invitation matching this user's email
    const pendingInvites = $app.findRecordsByFilter(
      'invitations',
      'invited_email = {:email} && accepted = false',
      '',
      1,
      0,
      { email: userEmail }
    )
    if (pendingInvites.length === 0) return // no invitation — user goes to /setup

    const invitation = pendingInvites[0]

    // Re-check membership inside the critical section to narrow the TOCTOU window
    // (two concurrent OAuth2 callbacks for the same user can both pass the first check)
    const doubleCheck = $app.findRecordsByFilter(
      'members',
      'user_id = {:userId}',
      '',
      1,
      0,
      { userId: userId }
    )
    if (doubleCheck.length > 0) return

    // Create member record linking user to the invited household
    const membersCol = $app.findCollectionByNameOrId('members')
    const member = new Record(membersCol)
    member.set('household_id', invitation.get('household_id'))
    member.set('user_id', userId)
    member.set('role', 'member')
    $app.save(member)

    // Mark invitation as accepted so it is not re-used
    invitation.set('accepted', true)
    $app.save(invitation)

  } catch (err) {
    // Hook errors must never break the auth flow
    console.error('[invitations hook] error:', err)
  }
})
