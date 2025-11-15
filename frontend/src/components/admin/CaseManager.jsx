import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'

export default function CaseManager() {
  const [cases, setCases] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    clinicalHistory: ''
  })
  const [selectedFiles, setSelectedFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    try {
      const response = await axios.get('/api/cases')
      setCases(response.data.cases)
    } catch (error) {
      console.error('Error fetching cases:', error)
    } finally {
      setLoading(false)
    }
  }

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.dcm']
    },
    onDrop: acceptedFiles => {
      setSelectedFiles(prev => [...prev, ...acceptedFiles])
    }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title || !formData.clinicalHistory) {
      alert('Please fill in all fields')
      return
    }

    if (selectedFiles.length === 0) {
      alert('Please upload at least one image')
      return
    }

    const data = new FormData()
    data.append('title', formData.title)
    data.append('clinicalHistory', formData.clinicalHistory)
    selectedFiles.forEach(file => {
      data.append('images', file)
    })

    try {
      const response = await axios.post('/api/cases', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setCases([response.data.case, ...cases])
      setFormData({ title: '', clinicalHistory: '' })
      setSelectedFiles([])
      setShowCreateForm(false)
      alert('Case created successfully')
    } catch (error) {
      console.error('Error creating case:', error)
      alert('Failed to create case')
    }
  }

  const deleteCase = async (caseId) => {
    if (!confirm('Are you sure you want to delete this case?')) return

    try {
      await axios.delete(`/api/cases/${caseId}`)
      setCases(cases.filter(c => c._id !== caseId))
    } catch (error) {
      console.error('Error deleting case:', error)
      alert('Failed to delete case')
    }
  }

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  if (loading) {
    return <div>Loading cases...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manage Cases</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel' : 'Create New Case'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Case</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Case Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Acute Appendicitis"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clinical History
              </label>
              <textarea
                value={formData.clinicalHistory}
                onChange={(e) => setFormData({ ...formData, clinicalHistory: e.target.value })}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter detailed clinical history..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Images
              </label>
              <div
                {...getRootProps()}
                className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-indigo-500"
              >
                <input {...getInputProps()} />
                <p className="text-gray-600">
                  Drag & drop images here, or click to select files
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Supports: JPEG, PNG, GIF, DICOM
                </p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Selected files ({selectedFiles.length}):</p>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Create Case
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {cases.length === 0 ? (
          <p className="text-gray-500">No cases yet. Create one above.</p>
        ) : (
          cases.map(caseItem => (
            <div key={caseItem._id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{caseItem.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{caseItem.clinicalHistory}</p>
                </div>
                <button
                  onClick={() => deleteCase(caseItem._id)}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {caseItem.images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={`/${image.path}`}
                      alt={image.originalName}
                      className="w-full h-32 object-cover rounded border"
                    />
                    <p className="text-xs text-gray-600 mt-1 truncate">{image.originalName}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Created: {new Date(caseItem.createdAt).toLocaleDateString()} by {caseItem.createdBy?.firstName} {caseItem.createdBy?.lastName}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
