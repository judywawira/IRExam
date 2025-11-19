import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function ExamSession() {
  const { sessionId } = useParams()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const socketRef = useRef(null)

  const [session, setSession] = useState(null)
  const [currentCase, setCurrentCase] = useState(null)
  const [currentImage, setCurrentImage] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [loading, setLoading] = useState(true)

  const isExaminer = user.role === 'examiner' || user.role === 'admin'

  useEffect(() => {
    fetchSession()
    setupSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [sessionId])

  // Timer effect
  useEffect(() => {
    let interval
    if (isRunning && timeRemaining > 0 && isExaminer) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1
          if (socketRef.current && newTime % 5 === 0) {
            socketRef.current.emit('update-timer', { sessionId, timeRemaining: newTime })
          }
          return newTime
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning, timeRemaining, isExaminer, sessionId])

  const fetchSession = async () => {
    try {
      const response = await axios.get(`/api/sessions/${sessionId}`)
      setSession(response.data.session)
      setTimeRemaining(response.data.session.timeRemaining)
      updateCurrentDisplay(
        response.data.session.exam,
        response.data.session.currentCaseIndex,
        response.data.session.currentImageIndex
      )
    } catch (error) {
      console.error('Error fetching session:', error)
      alert('Failed to load session')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const setupSocket = () => {
    socketRef.current = io('http://localhost:5000', {
      auth: { token }
    })

    socketRef.current.emit('join-session', sessionId)

    socketRef.current.on('session-state', (data) => {
      setTimeRemaining(data.timeRemaining)
      setIsRunning(data.status === 'active')
      updateCurrentDisplay(data.exam, data.currentCaseIndex, data.currentImageIndex)
    })

    socketRef.current.on('exam-started', (data) => {
      setIsRunning(true)
    })

    socketRef.current.on('exam-paused', () => {
      setIsRunning(false)
    })

    socketRef.current.on('exam-resumed', () => {
      setIsRunning(true)
    })

    socketRef.current.on('exam-ended', () => {
      setIsRunning(false)
      alert('Exam has ended')
    })

    socketRef.current.on('image-changed', ({ caseIndex, imageIndex }) => {
      if (session?.exam) {
        updateCurrentDisplay(session.exam, caseIndex, imageIndex)
        // Update session state
        setSession(prev => ({
          ...prev,
          currentCaseIndex: caseIndex,
          currentImageIndex: imageIndex
        }))
      }
    })

    socketRef.current.on('timer-update', ({ timeRemaining }) => {
      setTimeRemaining(timeRemaining)
    })

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error)
    })
  }

  const updateCurrentDisplay = (exam, caseIndex, imageIndex) => {
    if (!exam || !exam.cases) return
    const caseData = exam.cases[caseIndex]
    setCurrentCase(caseData)
    setCurrentImage(caseData?.images[imageIndex])
  }

  const handleStart = () => {
    socketRef.current.emit('start-exam', sessionId)
  }

  const handlePause = () => {
    socketRef.current.emit('pause-exam', sessionId)
  }

  const handleResume = () => {
    socketRef.current.emit('resume-exam', sessionId)
  }

  const handleEnd = () => {
    if (confirm('Are you sure you want to end this exam?')) {
      socketRef.current.emit('end-exam', sessionId)
    }
  }

  const navigateImage = (caseIndex, imageIndex) => {
    if (!session?.exam?.cases) return
    const caseData = session.exam.cases[caseIndex]
    if (!caseData || !caseData.images[imageIndex]) return

    socketRef.current.emit('navigate-image', {
      sessionId,
      caseIndex,
      imageIndex
    })
  }

  const nextImage = () => {
    if (!session?.exam?.cases || !currentCase) return
    const currentCaseIndex = session.currentCaseIndex
    const currentImageIndex = session.currentImageIndex

    if (currentImageIndex < currentCase.images.length - 1) {
      navigateImage(currentCaseIndex, currentImageIndex + 1)
    } else if (currentCaseIndex < session.exam.cases.length - 1) {
      navigateImage(currentCaseIndex + 1, 0)
    }
  }

  const previousImage = () => {
    if (!session?.exam?.cases) return
    const currentCaseIndex = session.currentCaseIndex
    const currentImageIndex = session.currentImageIndex

    if (currentImageIndex > 0) {
      navigateImage(currentCaseIndex, currentImageIndex - 1)
    } else if (currentCaseIndex > 0) {
      const prevCase = session.exam.cases[currentCaseIndex - 1]
      navigateImage(currentCaseIndex - 1, prevCase.images.length - 1)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading session...</div>
  }

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen">Session not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{session.exam.title}</h1>
            <p className="text-sm text-gray-400">
              {isExaminer ? 'Examiner View' : 'Student View'}
              {session.status === 'scheduled' && ' - Waiting to Start'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-mono font-bold">
              {formatTime(timeRemaining)}
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Main Display Area */}
        <div className="flex-1 flex flex-col p-6">
          {/* Clinical History - Displayed First */}
          {currentCase && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-3 text-blue-400">
                Case {session.currentCaseIndex + 1}: {currentCase.title}
              </h3>
              <div className="bg-gray-900 p-4 rounded">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Clinical History</h4>
                <p className="text-gray-300 leading-relaxed">{currentCase.clinicalHistory}</p>
              </div>
            </div>
          )}

          {/* Image Display */}
          <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-lg p-4">
            {currentImage ? (
              <>
                <img
                  src={`/${currentImage.path}`}
                  alt={currentImage.originalName}
                  className="w-full h-auto max-h-[55vh] object-contain rounded-lg shadow-lg"
                />
                <p className="text-center mt-4 text-gray-400">
                  Case {session.currentCaseIndex + 1} / {session.exam.cases.length} -
                  Image {session.currentImageIndex + 1} / {currentCase?.images.length}
                </p>
                {isExaminer && currentImage.description && (
                  <p className="text-center mt-2 text-gray-500 text-sm italic">
                    {currentImage.description}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 text-lg mb-2">No image to display</p>
                {session.status === 'scheduled' && (
                  <p className="text-gray-500">Waiting for examiner to start the exam...</p>
                )}
              </div>
            )}
          </div>

          {/* Thumbnail Navigation for Examiners */}
          {isExaminer && currentCase && (
            <div className="mt-4 bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">Images in Current Case</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {currentCase.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigateImage(session.currentCaseIndex, idx)}
                    className={`flex-shrink-0 relative ${
                      session.currentImageIndex === idx
                        ? 'ring-2 ring-blue-500'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={`/${img.path}`}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded"
                    />
                    <span className="absolute bottom-0 right-0 bg-black bg-opacity-75 text-xs px-1 rounded-tl">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-6 overflow-y-auto">
          {/* Examiner Controls */}
          {isExaminer && (
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold">Controls</h3>

              {session.status === 'scheduled' && (
                <button
                  onClick={handleStart}
                  className="w-full px-4 py-2 bg-green-600 rounded hover:bg-green-700"
                >
                  Start Exam
                </button>
              )}

              {session.status === 'active' && (
                <>
                  <button
                    onClick={handlePause}
                    className="w-full px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700"
                  >
                    Pause Exam
                  </button>
                  <button
                    onClick={handleEnd}
                    className="w-full px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                  >
                    End Exam
                  </button>
                </>
              )}

              {session.status === 'paused' && (
                <button
                  onClick={handleResume}
                  className="w-full px-4 py-2 bg-green-600 rounded hover:bg-green-700"
                >
                  Resume Exam
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={previousImage}
                  disabled={session.currentCaseIndex === 0 && session.currentImageIndex === 0}
                  className="flex-1 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={nextImage}
                  className="flex-1 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Next
                </button>
              </div>

              {/* Case Navigator */}
              <div className="pt-4 border-t border-gray-700">
                <h4 className="text-sm font-semibold mb-2">Jump to Case</h4>
                <div className="grid grid-cols-3 gap-2">
                  {session.exam.cases.map((caseItem, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigateImage(idx, 0)}
                      className={`px-3 py-2 rounded text-sm ${
                        session.currentCaseIndex === idx
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      Case {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Discussion Points (Examiner Only) */}
          {isExaminer && currentCase && currentCase.discussionPoints && currentCase.discussionPoints.length > 0 && (
            <div className="mb-6 pb-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold mb-3 text-yellow-400">Discussion Points</h3>
              <div className="space-y-3">
                {currentCase.discussionPoints
                  .sort((a, b) => a.order - b.order)
                  .map((dp, idx) => (
                    <div key={idx} className="bg-gray-900 p-3 rounded">
                      <span className="text-yellow-400 font-semibold mr-2">{idx + 1}.</span>
                      <span className="text-gray-300">{dp.point}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Participants */}
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Participants ({session.participants.length})
            </h3>
            {session.participants.length === 0 ? (
              <p className="text-sm text-gray-400">No students have joined yet</p>
            ) : (
              <div className="space-y-2">
                {session.participants.map((p, i) => (
                  <div key={i} className="text-sm text-gray-300 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {p.student?.firstName} {p.student?.lastName}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Students (For Examiner) */}
          {isExaminer && session.assignedStudents && session.assignedStudents.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold mb-2">
                Assigned Students ({session.assignedStudents.length})
              </h3>
              <div className="space-y-2">
                {session.assignedStudents.map((student, i) => (
                  <div key={i} className="text-sm text-gray-300">
                    {student.firstName} {student.lastName}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
