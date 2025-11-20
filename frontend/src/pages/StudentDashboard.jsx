import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchSessions()
    // Poll for new sessions every 30 seconds
    const interval = setInterval(fetchSessions, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await axios.get('/api/sessions')
      // Only show active and scheduled sessions assigned to this student
      const availableSessions = response.data.sessions.filter(
        s => (s.status === 'active' || s.status === 'scheduled') && s.status !== 'completed'
      )
      setSessions(availableSessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const joinSession = async (sessionId) => {
    try {
      await axios.post(`/api/sessions/${sessionId}/join`)
      navigate(`/session/${sessionId}`)
    } catch (error) {
      console.error('Error joining session:', error)
      if (error.response?.status === 403) {
        alert(error.response.data.message || 'You are not assigned to this session.')
      } else {
        alert('Failed to join session. Please try again.')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">My Exam Sessions</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.firstName} {user.lastName}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {sessions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Sessions Available</h3>
            <p className="mt-2 text-gray-500">
              You don't have any exam sessions scheduled at the moment.
              <br />
              Check back later or contact your examiner.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map(session => {
              const isActive = session.status === 'active'
              const isScheduled = session.status === 'scheduled'

              return (
                <div
                  key={session._id}
                  className={`bg-white shadow-lg rounded-lg overflow-hidden border-l-4 ${
                    isActive ? 'border-green-500' : 'border-blue-500'
                  }`}
                >
                  <div className="p-6">
                    {isActive && (
                      <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                        <p className="text-green-800 font-medium">
                          Your session is currently in progress
                        </p>
                      </div>
                    )}

                    {isScheduled && (
                      <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-800 font-medium">
                          Your session is about to begin. Please join when ready.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {session.name}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Exam: {session.exam.title}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-700">
                              {Math.floor(session.timeRemaining / 60)} minutes
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-gray-700">
                              {session.exam.cases?.length || 0} cases
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span className="text-gray-700">
                              {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-gray-700">
                              {session.examiner?.firstName} {session.examiner?.lastName}
                            </span>
                          </div>
                        </div>

                        {session.exam.description && (
                          <p className="text-gray-600 mb-4">{session.exam.description}</p>
                        )}
                      </div>

                      <button
                        onClick={() => joinSession(session._id)}
                        className={`ml-6 px-8 py-4 rounded-lg font-semibold text-white shadow-lg transition-all transform hover:scale-105 ${
                          isActive
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isActive ? 'Join Now' : 'Enter Exam'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
