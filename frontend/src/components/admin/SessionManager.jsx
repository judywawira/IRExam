import { useState, useEffect } from 'react'
import axios from 'axios'

export default function SessionManager() {
  const [sessions, setSessions] = useState([])
  const [examiners, setExaminers] = useState([])
  const [exams, setExams] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    examId: '',
    examinerId: ''
  })
  const [loading, setLoading] = useState(true)
  const [reassignData, setReassignData] = useState({
    sessionId: null,
    examinerId: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sessionsRes, examinersRes, examsRes] = await Promise.all([
        axios.get('/api/admin/sessions'),
        axios.get('/api/admin/examiners'),
        axios.get('/api/exams')
      ])
      setSessions(sessionsRes.data.sessions)
      setExaminers(examinersRes.data.examiners)
      setExams(examsRes.data.exams)
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.examId || !formData.examinerId) {
      alert('Please select both an exam and an examiner')
      return
    }

    try {
      const response = await axios.post('/api/admin/sessions', {
        examId: formData.examId,
        examinerId: formData.examinerId
      })
      setSessions([response.data.session, ...sessions])
      setFormData({ examId: '', examinerId: '' })
      setShowCreateForm(false)
      alert('Exam session created successfully')
    } catch (error) {
      console.error('Error creating session:', error)
      alert(error.response?.data?.message || 'Failed to create session')
    }
  }

  const handleReassign = async (sessionId) => {
    if (!reassignData.examinerId) {
      alert('Please select an examiner')
      return
    }

    try {
      const response = await axios.patch(
        `/api/admin/sessions/${sessionId}/assign-examiner`,
        { examinerId: reassignData.examinerId }
      )

      setSessions(sessions.map(s =>
        s._id === sessionId ? response.data.session : s
      ))
      setReassignData({ sessionId: null, examinerId: '' })
      alert('Examiner reassigned successfully')
    } catch (error) {
      console.error('Error reassigning examiner:', error)
      alert(error.response?.data?.message || 'Failed to reassign examiner')
    }
  }

  const deleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return

    try {
      await axios.delete(`/api/admin/sessions/${sessionId}`)
      setSessions(sessions.filter(s => s._id !== sessionId))
      alert('Session deleted successfully')
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session')
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div>Loading sessions...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manage Exam Sessions</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel' : 'Create New Session'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Exam Session</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Exam *
              </label>
              <select
                value={formData.examId}
                onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">-- Select an exam --</option>
                {exams.map(exam => (
                  <option key={exam._id} value={exam._id}>
                    {exam.title} ({exam.duration} min, {exam.cases.length} cases)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign Examiner *
              </label>
              <select
                value={formData.examinerId}
                onChange={(e) => setFormData({ ...formData, examinerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">-- Select an examiner --</option>
                {examiners.map(examiner => (
                  <option key={examiner._id} value={examiner._id}>
                    {examiner.firstName} {examiner.lastName} ({examiner.email})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Create Session
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No exam sessions yet. Create one above.</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session._id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{session.exam?.title}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Examiner:</span>{' '}
                        {session.examiner?.firstName} {session.examiner?.lastName}
                        <span className="text-gray-500 ml-1">({session.examiner?.email})</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Duration:</span> {session.exam?.duration} minutes
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Cases:</span> {session.exam?.cases?.length || 0}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Participants:</span> {session.participants?.length || 0}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Created:</span> {new Date(session.createdAt).toLocaleString()}
                      </p>
                      {session.startTime && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Started:</span> {new Date(session.startTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Reassign Examiner Section */}
                  {session.status === 'scheduled' && (
                    <div className="mt-4 p-4 bg-gray-50 rounded">
                      <p className="text-sm font-medium text-gray-700 mb-2">Reassign Examiner</p>
                      <div className="flex gap-2">
                        <select
                          value={reassignData.sessionId === session._id ? reassignData.examinerId : ''}
                          onChange={(e) => setReassignData({ sessionId: session._id, examinerId: e.target.value })}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">-- Select new examiner --</option>
                          {examiners.map(examiner => (
                            <option key={examiner._id} value={examiner._id}>
                              {examiner.firstName} {examiner.lastName}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleReassign(session._id)}
                          disabled={reassignData.sessionId !== session._id || !reassignData.examinerId}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Reassign
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Participants List */}
                  {session.participants && session.participants.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Participants:</p>
                      <div className="space-y-1">
                        {session.participants.map((participant, index) => (
                          <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {participant.student?.firstName} {participant.student?.lastName}
                            <span className="text-gray-400">
                              (joined {new Date(participant.joinedAt).toLocaleString()})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteSession(session._id)}
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
