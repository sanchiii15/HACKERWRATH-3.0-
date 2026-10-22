// Downloads the displayed result as a JSON file. No fake PDF.
export function downloadReport(result) {
  const report = {
    note: result.analysisMode === 'demo'
      ? 'DEMO report. Values are simulated and are not real detector output.'
      : 'Report from a live analysis service. Automated screening is not proof of authenticity or manipulation.',
    ...result,
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${result.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}
