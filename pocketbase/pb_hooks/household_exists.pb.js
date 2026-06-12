/// GET /api/household/exists  - returns whether any household exists on this instance.
/// Requires a valid auth token; no household membership needed.
routerAdd('GET', '/api/household/exists', (e) => {
  try {
    const authRecord = e.auth
    if (!authRecord) return e.json(401, { message: 'Unauthorized' })

    const records = $app.findRecordsByFilter('households', 'id != ""', '', 1, 0, {})
    return e.json(200, { exists: records.length > 0 })
  } catch (err) {
    console.error('[household-exists] error:', err)
    return e.json(500, { message: 'Server error' })
  }
})
