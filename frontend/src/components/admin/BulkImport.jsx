import { useState } from 'react'

export default function BulkImport({ onClose, onImport }) {
  const [importData, setImportData] = useState('')
  const [error, setError] = useState('')

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setImportData(event.target.result)
      setError('')
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importData)

      // Validate the data structure
      if (!Array.isArray(parsed)) {
        setError('Invalid format: Expected an array of cases')
        return
      }

      // Validate each case
      for (const caseItem of parsed) {
        if (!caseItem.title || !caseItem.clinicalHistory) {
          setError('Invalid case data: Each case must have title and clinicalHistory')
          return
        }
      }

      onImport(parsed)
      onClose()
    } catch (err) {
      setError('Invalid JSON format: ' + err.message)
    }
  }

  const exampleFormat = [
    {
      title: 'Case Title 1',
      clinicalHistory: 'Patient history and symptoms...',
      discussionPoints: [
        { point: 'Discussion point 1', order: 0 },
        { point: 'Discussion point 2', order: 1 }
      ]
    },
    {
      title: 'Case Title 2',
      clinicalHistory: 'Another patient history...',
      discussionPoints: []
    }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="bg-indigo-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center sticky top-0">
          <h2 className="text-xl font-bold">Bulk Import Cases</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Import from JSON File</h3>
            <p className="text-sm text-gray-600 mb-3">
              Upload a JSON file containing an array of case objects. Images must be uploaded separately after import.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or Paste JSON Data
            </label>
            <textarea
              value={importData}
              onChange={(e) => {
                setImportData(e.target.value)
                setError('')
              }}
              rows="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              placeholder="Paste JSON array here..."
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <h4 className="font-semibold text-sm mb-2">Example Format:</h4>
            <pre className="text-xs bg-gray-100 p-3 rounded border border-gray-200 overflow-x-auto">
              {JSON.stringify(exampleFormat, null, 2)}
            </pre>
            <p className="text-xs text-gray-600 mt-2">
              <strong>Note:</strong> Images must be added individually after importing cases.
              Discussion points are optional.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleImport}
              disabled={!importData}
              className={`flex-1 px-4 py-2 rounded font-medium ${
                importData
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Import Cases
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
