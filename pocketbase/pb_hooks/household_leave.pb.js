/// POST /api/household/leave — non-admin member voluntarily leaves the household
function redistributeRatios(splitRatios, leavingMemberId) {
  const remainingIds = Object.keys(splitRatios).filter(function(id) { return id !== leavingMemberId })
  if (remainingIds.length === 0) return {}
  if (remainingIds.length === 1) {
    const result = {}
    result[remainingIds[0]] = 100
    return result
  }
  const remainingSum = remainingIds.reduce(function(s, id) { return s + (splitRatios[id] || 0) }, 0)
  const result = {}
  let total = 0
  for (let i = 0; i < remainingIds.length; i++) {
    const id = remainingIds[i]
    if (i === remainingIds.length - 1) {
      result[id] = 100 - total
    } else if (remainingSum === 0) {
      const equal = Math.floor(100 / remainingIds.length)
      result[id] = equal
      total += equal
    } else {
      result[id] = Math.round((splitRatios[id] / remainingSum) * 100)
      total += result[id]
    }
  }
  return result
}

routerAdd('POST', '/api/household/leave', (e) => {
  try {
    const authRecord = e.auth
    if (!authRecord) return e.json(401, { message: 'Unauthorized' })
    const userId = authRecord.id

    const memberRecords = $app.findRecordsByFilter('members', 'user_id = {:uid}', '', 1, 0, { uid: userId })
    if (memberRecords.length === 0) return e.json(404, { message: 'Not a member of any household' })
    const callerMember = memberRecords[0]
    const householdId = callerMember.get('household_id')

    // Sole-admin guard
    if (callerMember.get('role') === 'admin') {
      const admins = $app.findRecordsByFilter('members', 'household_id = {:hid} && role = "admin"', '', 2, 0, { hid: householdId })
      if (admins.length <= 1) {
        return e.json(403, { message: 'Sole admin cannot leave. Promote another member first, or delete the household.' })
      }
    }

    const household = $app.findRecordById('households', householdId)
    const splitRatios = household.get('split_ratios') || {}
    const newRatios = redistributeRatios(splitRatios, callerMember.id)

    $app.runInTransaction((txApp) => {
      txApp.delete(callerMember)
      household.set('split_ratios', newRatios)
      txApp.save(household)
    })

    return e.json(200, { message: 'Left household' })
  } catch (err) {
    console.error('[leave-household] error:', err)
    return e.json(500, { message: 'Server error' })
  }
})
