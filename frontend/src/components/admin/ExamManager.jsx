import { useState, useEffect } from 'react'
import axios from 'axios'
import ExamPreview from './ExamPreview'

export default function ExamManager() {
  const [exams, setExams] = useState([])
  const [cases, setCases] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [previewExamId, setPreviewExamId] = useState(null)
  const [editingExam, setEditingExam] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    selectedCases: []
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [examsRes, casesRes] = await Promise.all([
        axios.get('/api/exams'),
        axios.get('/api/cases')
      ])
      setExams(examsRes.data.exams)
      setCases(casesRes.data.cases)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title || formData.selectedCases.length === 0) {
      alert('Please fill in all required fields and select at least one case')
      return
    }

    try {
      const response = await axios.post('/api/exams', {
        title: formData.title,
        description: formData.description,
        duration: formData.duration,
        cases: formData.selectedCases
      })
      setExams([response.data.exam, ...exams])
      setFormData({
        title: '',
        description: '',
        duration: 60,
        selectedCases: []
      })
      setShowCreateForm(false)
      alert('Exam created successfully')
    } catch (error) {
      console.error('Error creating exam:', error)
      alert('Failed to create exam')
    }
  }

  const deleteExam = async (examId) => {
    if (!confirm('Are you sure you want to delete this exam?')) return

    try {
      await axios.delete(`/api/exams/${examId}`)
      setExams(exams.filter(e => e._id !== examId))
      alert('Exam deleted successfully')
    } catch (error) {
      console.error('Error deleting exam:', error)
      alert('Failed to delete exam')
    }
  }

  const cloneExam = async (examId) => {
    if (!confirm('Clone this exam? A copy will be created with the same cases and settings.')) return

    try {
      const response = await axios.post(`/api/exams/${examId}/clone`)
      setExams([response.data.exam, ...exams])
      alert('Exam cloned successfully')
      fetchData() // Refresh to get the latest data
    } catch (error) {
      console.error('Error cloning exam:', error)
      alert('Failed to clone exam')
    }
  }

  const startEditExam = (exam) => {
    setEditingExam(exam)
    setFormData({
      title: exam.title,
      description: exam.description || '',
      duration: exam.duration,
      selectedCases: exam.cases.map(c => c._id)
    })
    setShowCreateForm(false)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()

    if (!formData.title || formData.selectedCases.length === 0) {
      alert('Please fill in all required fields and select at least one case')
      return
    }

    try {
      const response = await axios.put(`/api/exams/${editingExam._id}`, {
        title: formData.title,
        description: formData.description,
        duration: formData.duration,
        cases: formData.selectedCases
      })
      setExams(exams.map(e => e._id === editingExam._id ? response.data.exam : e))
      setFormData({
        title: '',
        description: '',
        duration: 60,
        selectedCases: []
      })
      setEditingExam(null)
      alert('Exam updated successfully')
    } catch (error) {
      console.error('Error updating exam:', error)
      alert('Failed to update exam')
    }
  }

  const cancelEdit = () => {
    setEditingExam(null)
    setFormData({
      title: '',
      description: '',
      duration: 60,
      selectedCases: []
    })
  }

  const toggleCaseSelection = (caseId) => {
    setFormData(prev => ({
      ...prev,
      selectedCases: prev.selectedCases.includes(caseId)
        ? prev.selectedCases.filter(id => id !== caseId)
        : [...prev.selectedCases, caseId]
    }))
  }

  const filteredCases = cases.filter(caseItem => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      caseItem.title.toLowerCase().includes(query) ||
      caseItem.clinicalHistory.toLowerCase().includes(query)
    )
  })

  const selectAllFiltered = () => {
    const filteredIds = filteredCases.map(c => c._id)
    setFormData(prev => ({
      ...prev,
      selectedCases: [...new Set([...prev.selectedCases, ...filteredIds])]
    }))
  }

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredCases.map(c => c._id))
    setFormData(prev => ({
      ...prev,
      selectedCases: prev.selectedCases.filter(id => !filteredIds.has(id))
    }))
  }

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', index)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    const dragIndex = parseInt(e.dataTransfer.getData('text/html'))

    if (dragIndex === dropIndex) return

    const newSelectedCases = [...formData.selectedCases]
    const [removed] = newSelectedCases.splice(dragIndex, 1)
    newSelectedCases.splice(dropIndex, 0, removed)

    setFormData(prev => ({
      ...prev,
      selectedCases: newSelectedCases
    }))
  }

  const moveCase = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= formData.selectedCases.length) return

    const newSelectedCases = [...formData.selectedCases]
    const [removed] = newSelectedCases.splice(index, 1)
    newSelectedCases.splice(newIndex, 0, removed)

    setFormData(prev => ({
      ...prev,
      selectedCases: newSelectedCases
    }))
  }

  if (loading) {
    return <div>Loading exams...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manage Exams</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel' : 'Create New Exam'}
        </button>
      </div>

      {editingExam && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Edit Exam</h3>
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
                Exam Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Mid-term Radiology Exam"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Optional exam description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes) *
              </label>
              <input
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Cases * ({formData.selectedCases.length} selected)
              </label>

              {/* Search and bulk actions */}
              <div className="mb-3 space-y-2">
                <input
                  type="text"
                  placeholder="Search cases by title or clinical history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                  >
                    Select All {searchQuery && `(${filteredCases.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Deselect All {searchQuery && `(${filteredCases.length})`}
                  </button>
                  {searchQuery && (
                    <span className="text-sm text-gray-600 py-1">
                      Showing {filteredCases.length} of {cases.length} cases
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                {cases.length === 0 ? (
                  <p className="p-4 text-gray-500">No cases available. Create some cases first.</p>
                ) : filteredCases.length === 0 ? (
                  <p className="p-4 text-gray-500">No cases match your search.</p>
                ) : (
                  <div className="divide-y">
                    {filteredCases.map(caseItem => (
                      <div
                        key={caseItem._id}
                        className="p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleCaseSelection(caseItem._id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={formData.selectedCases.includes(caseItem._id)}
                            onChange={() => {}}
                            className="mt-1"
                          />
                          {caseItem.images.length > 0 && (
                            <div className="flex-shrink-0">
                              <img
                                src={`/${caseItem.images[0].path}`}
                                alt={caseItem.title}
                                className="w-20 h-20 object-cover rounded border border-gray-300"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium">{caseItem.title}</h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {caseItem.clinicalHistory.substring(0, 100)}...
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>{caseItem.images.length} image(s)</span>
                              {caseItem.images.length > 1 && (
                                <span className="text-indigo-600">+{caseItem.images.length - 1} more</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Case Order Display */}
            {formData.selectedCases.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Order (Drag to reorder)
                </label>
                <div className="border border-gray-300 rounded-md p-3 space-y-2 bg-gray-50">
                  {formData.selectedCases.map((caseId, index) => {
                    const caseItem = cases.find(c => c._id === caseId)
                    if (!caseItem) return null
                    return (
                      <div
                        key={caseId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        className="bg-white p-3 rounded border border-gray-200 cursor-move hover:border-indigo-400 hover:shadow-sm transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => moveCase(index, 'up')}
                              disabled={index === 0}
                              className={`text-xs ${index === 0 ? 'text-gray-300' : 'text-gray-600 hover:text-indigo-600'}`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCase(index, 'down')}
                              disabled={index === formData.selectedCases.length - 1}
                              className={`text-xs ${index === formData.selectedCases.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:text-indigo-600'}`}
                            >
                              ▼
                            </button>
                          </div>
                          <span className="font-semibold text-gray-700 w-6">{index + 1}.</span>
                          {caseItem.images.length > 0 && (
                            <img
                              src={`/${caseItem.images[0].path}`}
                              alt={caseItem.title}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-sm">{caseItem.title}</div>
                            <div className="text-xs text-gray-500">{caseItem.images.length} images</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCaseSelection(caseId)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Update Exam
            </button>
          </form>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Exam</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exam Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Mid-term Radiology Exam"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Optional exam description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes) *
              </label>
              <input
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Cases * ({formData.selectedCases.length} selected)
              </label>

              {/* Search and bulk actions */}
              <div className="mb-3 space-y-2">
                <input
                  type="text"
                  placeholder="Search cases by title or clinical history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                  >
                    Select All {searchQuery && `(${filteredCases.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Deselect All {searchQuery && `(${filteredCases.length})`}
                  </button>
                  {searchQuery && (
                    <span className="text-sm text-gray-600 py-1">
                      Showing {filteredCases.length} of {cases.length} cases
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                {cases.length === 0 ? (
                  <p className="p-4 text-gray-500">No cases available. Create some cases first.</p>
                ) : filteredCases.length === 0 ? (
                  <p className="p-4 text-gray-500">No cases match your search.</p>
                ) : (
                  <div className="divide-y">
                    {filteredCases.map(caseItem => (
                      <div
                        key={caseItem._id}
                        className="p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleCaseSelection(caseItem._id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={formData.selectedCases.includes(caseItem._id)}
                            onChange={() => {}}
                            className="mt-1"
                          />
                          {caseItem.images.length > 0 && (
                            <div className="flex-shrink-0">
                              <img
                                src={`/${caseItem.images[0].path}`}
                                alt={caseItem.title}
                                className="w-20 h-20 object-cover rounded border border-gray-300"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium">{caseItem.title}</h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {caseItem.clinicalHistory.substring(0, 100)}...
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>{caseItem.images.length} image(s)</span>
                              {caseItem.images.length > 1 && (
                                <span className="text-indigo-600">+{caseItem.images.length - 1} more</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Case Order Display */}
            {formData.selectedCases.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Order (Drag to reorder)
                </label>
                <div className="border border-gray-300 rounded-md p-3 space-y-2 bg-gray-50">
                  {formData.selectedCases.map((caseId, index) => {
                    const caseItem = cases.find(c => c._id === caseId)
                    if (!caseItem) return null
                    return (
                      <div
                        key={caseId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        className="bg-white p-3 rounded border border-gray-200 cursor-move hover:border-indigo-400 hover:shadow-sm transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => moveCase(index, 'up')}
                              disabled={index === 0}
                              className={`text-xs ${index === 0 ? 'text-gray-300' : 'text-gray-600 hover:text-indigo-600'}`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCase(index, 'down')}
                              disabled={index === formData.selectedCases.length - 1}
                              className={`text-xs ${index === formData.selectedCases.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:text-indigo-600'}`}
                            >
                              ▼
                            </button>
                          </div>
                          <span className="font-semibold text-gray-700 w-6">{index + 1}.</span>
                          {caseItem.images.length > 0 && (
                            <img
                              src={`/${caseItem.images[0].path}`}
                              alt={caseItem.title}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-sm">{caseItem.title}</div>
                            <div className="text-xs text-gray-500">{caseItem.images.length} images</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCaseSelection(caseId)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Create Exam
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {exams.length === 0 ? (
          <p className="text-gray-500">No exams yet. Create one above.</p>
        ) : (
          exams.map(exam => (
            <div key={exam._id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{exam.title}</h3>
                  {exam.description && (
                    <p className="text-sm text-gray-600 mt-1">{exam.description}</p>
                  )}
                  <div className="mt-3 flex gap-4 text-sm text-gray-600">
                    <span>Duration: {exam.duration} minutes</span>
                    <span>Cases: {exam.cases.length}</span>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Cases in this exam:</p>
                    <div className="space-y-2">
                      {exam.cases.map((caseItem, index) => (
                        <div key={caseItem._id} className="text-sm bg-gray-50 p-3 rounded">
                          <span className="font-medium">{index + 1}. {caseItem.title}</span>
                          <span className="text-gray-600 ml-2">
                            ({caseItem.images?.length || 0} images)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    Created: {new Date(exam.createdAt).toLocaleDateString()} by {exam.createdBy?.firstName} {exam.createdBy?.lastName}
                  </div>
                </div>

                <div className="ml-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setPreviewExamId(exam._id)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => cloneExam(exam._id)}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                  >
                    Clone
                  </button>
                  <button
                    onClick={() => startEditExam(exam)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteExam(exam._id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {previewExamId && (
        <ExamPreview
          examId={previewExamId}
          onClose={() => setPreviewExamId(null)}
        />
      )}
    </div>
  )
}
