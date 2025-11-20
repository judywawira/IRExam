import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import BulkImport from './BulkImport'

export default function CaseManager() {
  const [cases, setCases] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCase, setEditingCase] = useState(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    clinicalHistory: ''
  })
  const [selectedFiles, setSelectedFiles] = useState([])
  const [imageDescriptions, setImageDescriptions] = useState({})
  const [discussionPoints, setDiscussionPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCases, setExpandedCases] = useState({})

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
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.dcm'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
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

  const startEditCase = (caseItem) => {
    setEditingCase(caseItem)
    setFormData({
      title: caseItem.title,
      clinicalHistory: caseItem.clinicalHistory
    })
    setSelectedFiles([])

    // Initialize image descriptions from existing case
    const descriptions = {}
    caseItem.images.forEach(image => {
      descriptions[image._id] = image.description || ''
    })
    setImageDescriptions(descriptions)

    // Initialize discussion points
    setDiscussionPoints(caseItem.discussionPoints || [])

    setShowCreateForm(false)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()

    if (!formData.title || !formData.clinicalHistory) {
      alert('Please fill in all fields')
      return
    }

    const data = new FormData()
    data.append('title', formData.title)
    data.append('clinicalHistory', formData.clinicalHistory)

    // Append discussion points
    data.append('discussionPoints', JSON.stringify(discussionPoints))

    // Append image descriptions
    data.append('imageDescriptions', JSON.stringify(imageDescriptions))

    // Only append new images if any were selected
    selectedFiles.forEach(file => {
      data.append('newImages', file)
    })

    try {
      const response = await axios.put(`/api/cases/${editingCase._id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setCases(cases.map(c => c._id === editingCase._id ? response.data.case : c))
      setFormData({ title: '', clinicalHistory: '' })
      setSelectedFiles([])
      setImageDescriptions({})
      setDiscussionPoints([])
      setEditingCase(null)
      alert('Case updated successfully')
    } catch (error) {
      console.error('Error updating case:', error)
      alert('Failed to update case')
    }
  }

  const cancelEdit = () => {
    setEditingCase(null)
    setFormData({ title: '', clinicalHistory: '' })
    setSelectedFiles([])
    setImageDescriptions({})
    setDiscussionPoints([])
  }

  const addDiscussionPoint = () => {
    setDiscussionPoints([...discussionPoints, { point: '', order: discussionPoints.length }])
  }

  const updateDiscussionPoint = (index, value) => {
    const updated = [...discussionPoints]
    updated[index].point = value
    setDiscussionPoints(updated)
  }

  const removeDiscussionPoint = (index) => {
    const updated = discussionPoints.filter((_, i) => i !== index)
    // Update order
    updated.forEach((point, i) => {
      point.order = i
    })
    setDiscussionPoints(updated)
  }

  const moveDiscussionPoint = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= discussionPoints.length) return

    const updated = [...discussionPoints]
    const [removed] = updated.splice(index, 1)
    updated.splice(newIndex, 0, removed)

    // Update order
    updated.forEach((point, i) => {
      point.order = i
    })

    setDiscussionPoints(updated)
  }

  const deleteImage = async (caseId, imageId) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      await axios.delete(`/api/cases/${caseId}/images/${imageId}`)
      // Update the case in state
      setCases(cases.map(c => {
        if (c._id === caseId) {
          return {
            ...c,
            images: c.images.filter(img => img._id !== imageId)
          }
        }
        return c
      }))

      // Also update editingCase if it's the one being edited
      if (editingCase && editingCase._id === caseId) {
        setEditingCase({
          ...editingCase,
          images: editingCase.images.filter(img => img._id !== imageId)
        })
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image')
    }
  }

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  const handleBulkImport = async (importedCases) => {
    try {
      // Import cases one by one (images will need to be added separately)
      const promises = importedCases.map(async (caseData) => {
        // Create a FormData to send the case data
        const formData = new FormData()
        formData.append('title', caseData.title)
        formData.append('clinicalHistory', caseData.clinicalHistory)

        // Add discussion points if provided
        if (caseData.discussionPoints) {
          formData.append('discussionPoints', JSON.stringify(caseData.discussionPoints))
        }

        return axios.post('/api/cases', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      })

      const results = await Promise.all(promises)
      const newCases = results.map(r => r.data.case)

      setCases([...newCases, ...cases])
      alert(`Successfully imported ${newCases.length} cases. You can now add images to each case by editing them.`)
      fetchCases() // Refresh to get the latest data
    } catch (error) {
      console.error('Bulk import error:', error)
      alert('Failed to import cases. Please check the format and try again.')
    }
  }

  const toggleCaseExpansion = (caseId) => {
    setExpandedCases(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }))
  }

  const isDicomFile = (image) => {
    if (!image) return false
    // Check database flag first, fallback to file extension for older files
    if (image.isDicom === true) return true
    // Fallback: check file extension
    const path = image.path || image.filename || ''
    return path.toLowerCase().endsWith('.dcm') || path.toLowerCase().endsWith('.dicom')
  }

  const filteredCases = cases.filter(caseItem => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const title = (caseItem.title || '').toLowerCase()
    const history = (caseItem.clinicalHistory || '').toLowerCase()
    const creator = `${caseItem.createdBy?.firstName || ''} ${caseItem.createdBy?.lastName || ''}`.toLowerCase()

    return title.includes(query) || history.includes(query) || creator.includes(query)
  })

  if (loading) {
    return <div>Loading cases...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Manage Cases</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkImport(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Bulk Import
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              {showCreateForm ? 'Cancel' : 'Create New Case'}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases by title, clinical history, or creator..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-gray-600 mt-2">
            Found {filteredCases.length} case(s) matching your search.
          </p>
        )}
      </div>

      {editingCase && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Edit Case</h3>
            <button
              onClick={cancelEdit}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleUpdate} className="space-y-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Images ({editingCase.images.length})
              </label>
              <div className="space-y-4">
                {editingCase.images.map((image) => (
                  <div key={image._id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex gap-4">
                      <div className="relative group flex-shrink-0">
                        <img
                          src={`/${image.path}`}
                          alt={image.originalName}
                          className="w-32 h-32 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => deleteImage(editingCase._id, image._id)}
                          className="absolute top-1 right-1 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 opacity-0 group-hover:opacity-100 transition"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 mb-2">{image.originalName}</p>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Image Description/Annotation (visible to examiners):
                        </label>
                        <textarea
                          value={imageDescriptions[image._id] || ''}
                          onChange={(e) => setImageDescriptions({
                            ...imageDescriptions,
                            [image._id]: e.target.value
                          })}
                          rows="2"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Add notes or annotations for this image..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add New Images (optional)
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
                  Supports: JPEG, PNG, GIF, DICOM, ZIP (with DICOM series)
                </p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">New files to add ({selectedFiles.length}):</p>
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

            {/* Discussion Points Editor */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Discussion Points ({discussionPoints.length})
                </label>
                <button
                  type="button"
                  onClick={addDiscussionPoint}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  + Add Point
                </button>
              </div>

              {discussionPoints.length === 0 ? (
                <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded border border-gray-200">
                  No discussion points yet. Add structured points for examiner reference.
                </p>
              ) : (
                <div className="space-y-2">
                  {discussionPoints.map((point, index) => (
                    <div key={index} className="flex items-start gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveDiscussionPoint(index, 'up')}
                          disabled={index === 0}
                          className={`text-xs ${index === 0 ? 'text-gray-300' : 'text-gray-600 hover:text-indigo-600'}`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDiscussionPoint(index, 'down')}
                          disabled={index === discussionPoints.length - 1}
                          className={`text-xs ${index === discussionPoints.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:text-indigo-600'}`}
                        >
                          ▼
                        </button>
                      </div>
                      <span className="font-semibold text-gray-700 mt-2">{index + 1}.</span>
                      <textarea
                        value={point.point}
                        onChange={(e) => updateDiscussionPoint(index, e.target.value)}
                        rows="2"
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter discussion point..."
                      />
                      <button
                        type="button"
                        onClick={() => removeDiscussionPoint(index)}
                        className="text-red-600 hover:text-red-800 text-sm mt-2"
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
              Update Case
            </button>
          </form>
        </div>
      )}

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
                  Supports: JPEG, PNG, GIF, DICOM, ZIP (with DICOM series)
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
        {filteredCases.length === 0 ? (
          <p className="text-gray-500">
            {searchQuery ? 'No cases match your search query.' : 'No cases yet. Create one above.'}
          </p>
        ) : (
          filteredCases.map(caseItem => (
            <div key={caseItem._id} className="bg-white shadow rounded-lg overflow-hidden">
              {/* Case Header - Always Visible */}
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <button
                    onClick={() => toggleCaseExpansion(caseItem._id)}
                    className="flex-1 text-left flex items-start gap-3 group"
                  >
                    <span className="text-gray-600 mt-1 transition-transform group-hover:text-indigo-600">
                      {expandedCases[caseItem._id] ? '▼' : '▶'}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold group-hover:text-indigo-600">
                        {caseItem.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {caseItem.clinicalHistory}
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        {caseItem.images.length} image(s) •
                        Created {new Date(caseItem.createdAt).toLocaleDateString()} by {caseItem.createdBy?.firstName} {caseItem.createdBy?.lastName}
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => startEditCase(caseItem)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCase(caseItem._id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedCases[caseItem._id] && (
                <div className="px-6 pb-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Clinical History:</h4>
                  <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{caseItem.clinicalHistory}</p>

                  {caseItem.discussionPoints && caseItem.discussionPoints.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Discussion Points:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {caseItem.discussionPoints.sort((a, b) => a.order - b.order).map((dp, idx) => (
                          <li key={idx} className="text-sm text-gray-600">{dp.point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Images ({caseItem.images.length}):</h4>
                  <div className="grid grid-cols-4 gap-4">
                    {caseItem.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={`/${image.path}`}
                          alt={image.originalName}
                          className="w-full h-32 object-cover rounded border"
                        />
                        {isDicomFile(image) && (
                          <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                            DICOM
                          </span>
                        )}
                        <p className="text-xs text-gray-600 mt-1 truncate" title={image.originalName}>
                          {image.originalName}
                        </p>
                        {image.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={image.description}>
                            {image.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showBulkImport && (
        <BulkImport
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
        />
      )}
    </div>
  )
}
