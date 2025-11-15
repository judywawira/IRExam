import { useState, useEffect } from 'react'
import axios from 'axios'

export default function ExamManager() {
  const [exams, setExams] = useState([])
  const [cases, setCases] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    selectedCases: []
  })
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
    } catch (error) {
      console.error('Error deleting exam:', error)
      alert('Failed to delete exam')
    }
  }

  const toggleCaseSelection = (caseId) => {
    setFormData(prev => ({
      ...prev,
      selectedCases: prev.selectedCases.includes(caseId)
        ? prev.selectedCases.filter(id => id !== caseId)
        : [...prev.selectedCases, caseId]
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
              <div className="border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                {cases.length === 0 ? (
                  <p className="p-4 text-gray-500">No cases available. Create some cases first.</p>
                ) : (
                  <div className="divide-y">
                    {cases.map(caseItem => (
                      <div
                        key={caseItem._id}
                        className="p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleCaseSelection(caseItem._id)}
                      >
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            checked={formData.selectedCases.includes(caseItem._id)}
                            onChange={() => {}}
                            className="mt-1 mr-3"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium">{caseItem.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {caseItem.clinicalHistory.substring(0, 100)}...
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {caseItem.images.length} image(s)
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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

                <button
                  onClick={() => deleteExam(exam._id)}
                  className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
