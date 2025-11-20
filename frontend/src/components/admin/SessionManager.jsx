import { useState, useEffect } from 'react'
import axios from 'axios'

export default function SessionManager() {
  const [sessions, setSessions] = useState([])
  const [examiners, setExaminers] = useState([])
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    examId: '',
    examinerIds: [],
    assignedStudents: [],
    examinerStudentPairs: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [showArchived])

  const fetchData = async () => {
    try {
      const [sessionsRes, examinersRes, examsRes, studentsRes] = await Promise.all([
        axios.get(`/api/admin/sessions?archived=${showArchived}`),
        axios.get('/api/admin/examiners'),
        axios.get('/api/exams'),
        axios.get('/api/admin/users?role=student&approved=true&archived=false')
      ])
      setSessions(sessionsRes.data.sessions)
      setExaminers(examinersRes.data.examiners)
      setExams(examsRes.data.exams)
      setStudents(studentsRes.data.users)
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      examId: '',
      examinerIds: [],
      assignedStudents: [],
      examinerStudentPairs: []
    })
    setEditingSession(null)
    setShowCreateForm(false)
  }

  const handleEdit = (session) => {
    setEditingSession(session)
    // Convert populated examinerStudentPairs to just IDs
    const pairs = (session.examinerStudentPairs || []).map(pair => ({
      examiner: typeof pair.examiner === 'object' ? pair.examiner._id : pair.examiner,
      student: typeof pair.student === 'object' ? pair.student._id : pair.student
    }))

    setFormData({
      name: session.name || '',
      examId: session.exam?._id || '',
      examinerIds: session.examiners?.map(e => e._id) || [session.examiner?._id] || [],
      assignedStudents: session.assignedStudents?.map(s => s._id) || [],
      examinerStudentPairs: pairs
    })
    setShowCreateForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.examId) {
      alert('Please provide a session name and select an exam')
      return
    }

    if (formData.examinerIds.length === 0) {
      alert('Please select at least one examiner')
      return
    }

    try {
      if (editingSession) {
        // Update existing session
        const response = await axios.patch(`/api/admin/sessions/${editingSession._id}`, {
          name: formData.name,
          examId: formData.examId,
          examinerIds: formData.examinerIds,
          assignedStudents: formData.assignedStudents,
          examinerStudentPairs: formData.examinerStudentPairs
        })
        setSessions(sessions.map(s => s._id === editingSession._id ? response.data.session : s))
        alert('Session updated successfully')
      } else {
        // Create new session
        const response = await axios.post('/api/admin/sessions', {
          name: formData.name,
          examId: formData.examId,
          examinerIds: formData.examinerIds,
          assignedStudents: formData.assignedStudents,
          examinerStudentPairs: formData.examinerStudentPairs
        })
        setSessions([response.data.session, ...sessions])
        alert('Session created successfully')
      }
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving session:', error)
      alert(error.response?.data?.message || 'Failed to save session')
    }
  }

  const handleExaminerToggle = (examinerId) => {
    setFormData(prev => {
      const isRemoving = prev.examinerIds.includes(examinerId)

      return {
        ...prev,
        examinerIds: isRemoving
          ? prev.examinerIds.filter(id => id !== examinerId)
          : [...prev.examinerIds, examinerId],
        // Remove any pairings for this examiner if unchecking
        examinerStudentPairs: isRemoving
          ? prev.examinerStudentPairs.filter(p => p.examiner !== examinerId)
          : prev.examinerStudentPairs
      }
    })
  }

  const handleStudentToggle = (studentId) => {
    setFormData(prev => {
      const isRemoving = prev.assignedStudents.includes(studentId)

      return {
        ...prev,
        assignedStudents: isRemoving
          ? prev.assignedStudents.filter(id => id !== studentId)
          : [...prev.assignedStudents, studentId],
        // Remove any pairings for this student if unchecking
        examinerStudentPairs: isRemoving
          ? prev.examinerStudentPairs.filter(p => p.student !== studentId)
          : prev.examinerStudentPairs
      }
    })
  }

  const handlePairExaminerStudent = (examinerId, studentId) => {
    setFormData(prev => {
      const existingPairIndex = prev.examinerStudentPairs.findIndex(
        p => p.student === studentId
      )

      let newPairs = [...prev.examinerStudentPairs]

      if (existingPairIndex >= 0) {
        // Update existing pair
        newPairs[existingPairIndex] = { examiner: examinerId, student: studentId }
      } else {
        // Add new pair
        newPairs.push({ examiner: examinerId, student: studentId })
      }

      return { ...prev, examinerStudentPairs: newPairs }
    })
  }

  const removePair = (studentId) => {
    setFormData(prev => ({
      ...prev,
      examinerStudentPairs: prev.examinerStudentPairs.filter(p => p.student !== studentId)
    }))
  }

  const deleteOrArchiveSession = async (session) => {
    const hasStudents = (session.assignedStudents?.length > 0) ||
                        (session.participants?.length > 0) ||
                        (session.examinerStudentPairs?.length > 0)

    const message = hasStudents
      ? 'This session has students assigned. It will be archived instead of deleted. Continue?'
      : 'Are you sure you want to delete this session?'

    if (!confirm(message)) return

    try {
      const response = await axios.delete(`/api/admin/sessions/${session._id}`)

      if (response.data.archived) {
        // Session was archived, update in list
        setSessions(sessions.map(s =>
          s._id === session._id ? response.data.session : s
        ))
        alert('Session has been archived')
      } else {
        // Session was deleted, remove from list
        setSessions(sessions.filter(s => s._id !== session._id))
        alert('Session deleted successfully')
      }

      fetchData()
    } catch (error) {
      console.error('Error deleting/archiving session:', error)
      alert('Failed to delete/archive session')
    }
  }

  const archiveSession = async (sessionId) => {
    if (!confirm('Are you sure you want to archive this session?')) return

    try {
      await axios.patch(`/api/admin/sessions/${sessionId}/archive`)
      alert('Session archived successfully')
      fetchData()
    } catch (error) {
      console.error('Error archiving session:', error)
      alert('Failed to archive session')
    }
  }

  const unarchiveSession = async (sessionId) => {
    if (!confirm('Are you sure you want to unarchive this session?')) return

    try {
      await axios.patch(`/api/admin/sessions/${sessionId}/unarchive`)
      alert('Session unarchived successfully')
      fetchData()
    } catch (error) {
      console.error('Error unarchiving session:', error)
      alert('Failed to unarchive session')
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

  const getPairedExaminer = (studentId) => {
    const pair = formData.examinerStudentPairs.find(p => p.student === studentId)
    return pair?.examiner || ''
  }

  if (loading) {
    return <div>Loading sessions...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manage Exam Sessions</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {showArchived ? 'Show Active' : 'Show Archived'}
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowCreateForm(!showCreateForm)
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            {showCreateForm ? 'Cancel' : 'Create New Session'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingSession ? 'Edit Exam Session' : 'Create New Exam Session'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Radiology Final Exam - Group A"
                required
              />
            </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Examiners * (Multiple allowed)
              </label>
              <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                {examiners.length === 0 ? (
                  <p className="text-sm text-gray-500">No examiners available</p>
                ) : (
                  examiners.map(examiner => (
                    <label key={examiner._id} className="flex items-center mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.examinerIds.includes(examiner._id)}
                        onChange={() => handleExaminerToggle(examiner._id)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {examiner.firstName} {examiner.lastName} ({examiner.email})
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Students (Optional)
              </label>
              <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                {students.length === 0 ? (
                  <p className="text-sm text-gray-500">No students available</p>
                ) : (
                  students.map(student => (
                    <label key={student._id} className="flex items-center mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.assignedStudents.includes(student._id)}
                        onChange={() => handleStudentToggle(student._id)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {student.firstName} {student.lastName} ({student.email})
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {formData.examinerIds.length > 0 && formData.assignedStudents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Examiner-Student Pairing (Optional 1:1 Matching)
                </label>
                <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                  {formData.assignedStudents.map(studentId => {
                    const student = students.find(s => s._id === studentId)
                    if (!student) return null

                    return (
                      <div key={studentId} className="flex items-center gap-3 mb-3">
                        <span className="text-sm flex-1">
                          {student.firstName} {student.lastName}
                        </span>
                        <select
                          value={getPairedExaminer(studentId)}
                          onChange={(e) => {
                            if (e.target.value) {
                              handlePairExaminerStudent(e.target.value, studentId)
                            } else {
                              removePair(studentId)
                            }
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          <option value="">-- No pairing --</option>
                          {formData.examinerIds.map(examinerId => {
                            const examiner = examiners.find(e => e._id === examinerId)
                            return (
                              <option key={examinerId} value={examinerId}>
                                {examiner?.firstName} {examiner?.lastName}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                {editingSession ? 'Update Session' : 'Create Session'}
              </button>
              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>
              {showArchived ? 'No archived sessions found.' : 'No active sessions yet. Create one above.'}
            </p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session._id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {session.name || session.exam?.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                    {session.isArchived && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
                        Archived
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Exam:</span> {session.exam?.title}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Primary Examiner:</span>{' '}
                        {session.examiner?.firstName} {session.examiner?.lastName}
                        <span className="text-gray-500 ml-1">({session.examiner?.email})</span>
                      </p>

                      {session.examiners && session.examiners.length > 1 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700">All Examiners:</p>
                          <ul className="text-sm text-gray-600 ml-4 list-disc">
                            {session.examiners.map(examiner => (
                              <li key={examiner._id}>
                                {examiner.firstName} {examiner.lastName}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Duration:</span> {session.exam?.duration} minutes
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Cases:</span> {session.exam?.cases?.length || 0}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Assigned Students:</span> {session.assignedStudents?.length || 0}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
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

                  {/* Examiner-Student Pairs */}
                  {session.examinerStudentPairs && session.examinerStudentPairs.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded">
                      <p className="text-sm font-medium text-gray-700 mb-2">Examiner-Student Pairings:</p>
                      <div className="space-y-1">
                        {session.examinerStudentPairs.map((pair, index) => (
                          <div key={index} className="text-sm text-gray-700">
                            <span className="font-medium">
                              {pair.examiner?.firstName} {pair.examiner?.lastName}
                            </span>
                            {' → '}
                            <span>
                              {pair.student?.firstName} {pair.student?.lastName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Students List */}
                  {session.assignedStudents && session.assignedStudents.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Assigned Students:</p>
                      <div className="flex flex-wrap gap-2">
                        {session.assignedStudents.map((student) => (
                          <span
                            key={student._id}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                          >
                            {student.firstName} {student.lastName}
                          </span>
                        ))}
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

                <div className="ml-4 flex flex-col gap-2">
                  {!session.isArchived && session.status === 'scheduled' && (
                    <button
                      onClick={() => handleEdit(session)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Edit
                    </button>
                  )}

                  {session.isArchived ? (
                    <button
                      onClick={() => unarchiveSession(session._id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Unarchive
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => archiveSession(session._id)}
                        className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => deleteOrArchiveSession(session)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
