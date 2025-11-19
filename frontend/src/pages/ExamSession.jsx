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
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
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
      const sessionData = response.data.session
      setSession(sessionData)
      setTimeRemaining(sessionData.timeRemaining)
      setCurrentCaseIndex(sessionData.currentCaseIndex)
      setCurrentImageIndex(sessionData.currentImageIndex)
      updateCurrentDisplay(
        sessionData.exam,
        sessionData.currentCaseIndex,
        sessionData.currentImageIndex
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
      setCurrentCaseIndex(data.currentCaseIndex)
      setCurrentImageIndex(data.currentImageIndex)
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
      console.log('Image changed:', caseIndex, imageIndex)
      setCurrentCaseIndex(caseIndex)
      setCurrentImageIndex(imageIndex)
      if (session?.exam) {
        updateCurrentDisplay(session.exam, caseIndex, imageIndex)
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

  const navigateToImage = (caseIndex, imageIndex) => {
    console.log('Navigating to:', caseIndex, imageIndex)
    if (!session?.exam?.cases) return
    const caseData = session.exam.cases[caseIndex]
    if (!caseData || !caseData.images[imageIndex]) return

    // Update local state immediately for responsive UI
    setCurrentCaseIndex(caseIndex)
    setCurrentImageIndex(imageIndex)
    updateCurrentDisplay(session.exam, caseIndex, imageIndex)

    // Emit socket event to sync with other participants
    socketRef.current.emit('navigate-image', {
      sessionId,
      caseIndex,
      imageIndex
    })
  }

  const nextImage = () => {
    if (!session?.exam?.cases || !currentCase) return

    if (currentImageIndex < currentCase.images.length - 1) {
      navigateToImage(currentCaseIndex, currentImageIndex + 1)
    } else if (currentCaseIndex < session.exam.cases.length - 1) {
      navigateToImage(currentCaseIndex + 1, 0)
    }
  }

  const previousImage = () => {
    if (!session?.exam?.cases) return

    if (currentImageIndex > 0) {
      navigateToImage(currentCaseIndex, currentImageIndex - 1)
    } else if (currentCaseIndex > 0) {
      const prevCase = session.exam.cases[currentCaseIndex - 1]
      navigateToImage(currentCaseIndex - 1, prevCase.images.length - 1)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Loading session...</div>
  }

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Session not found</div>
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
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {/* Clinical History - Displayed First */}
          {currentCase && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-3 text-blue-400">
                Case {currentCaseIndex + 1}: {currentCase.title}
              </h3>
              <div className="bg-gray-900 p-4 rounded">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Clinical History</h4>
                <p className="text-gray-300 leading-relaxed">{currentCase.clinicalHistory}</p>
              </div>
            </div>
          )}

          {/* Image Display */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center bg-black rounded-lg p-6 mb-6">
            {currentImage ? (
              <div className="w-full">
                <img
                  src={`/${currentImage.path}`}
                  alt={currentImage.originalName}
                  className="w-full h-auto max-h-[50vh] object-contain rounded-lg shadow-lg mx-auto"
                />
                <div className="text-center mt-4">
                  <p className="text-gray-400">
                    Case {currentCaseIndex + 1} / {session.exam.cases.length} -
                    Image {currentImageIndex + 1} / {currentCase?.images.length}
                  </p>
                  {currentImage.description && (
                    <p className="mt-2 text-gray-500 text-sm italic">
                      {currentImage.description}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg mb-2">No image to display</p>
                {session.status === 'scheduled' && (
                  <p className="text-gray-500">Waiting for examiner to start the exam...</p>
                )}
              </div>
            )}
          </div>

          {/* Image Tiles for Examiners */}
          {isExaminer && currentCase && currentCase.images.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-sm font-semibold mb-4 text-gray-300">
                All Images in Case {currentCaseIndex + 1} ({currentCase.images.length} images)
              </h4>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {currentCase.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigateToImage(currentCaseIndex, idx)}
                    className={`relative aspect-square rounded-lg overflow-hidden transition-all transform hover:scale-105 ${
                      currentImageIndex === idx
                        ? 'ring-4 ring-blue-500 shadow-lg shadow-blue-500/50'
                        : 'ring-1 ring-gray-600 hover:ring-2 hover:ring-gray-400'
                    }`}
                    title={`Image ${idx + 1}${img.description ? ': ' + img.description : ''}`}
                  >
                    <img
                      src={`/${img.path}`}
                      alt={`Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute bottom-1 right-1 bg-black/90 text-white text-xs px-2 py-1 rounded font-semibold">
                      {idx + 1}
                    </span>
                    {currentImageIndex === idx && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
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
                  className="w-full px-4 py-3 bg-green-600 rounded-lg hover:bg-green-700 font-semibold"
                >
                  Start Exam
                </button>
              )}

              {session.status === 'active' && (
                <>
                  <button
                    onClick={handlePause}
                    className="w-full px-4 py-3 bg-yellow-600 rounded-lg hover:bg-yellow-700 font-semibold"
                  >
                    Pause Exam
                  </button>
                  <button
                    onClick={handleEnd}
                    className="w-full px-4 py-3 bg-red-600 rounded-lg hover:bg-red-700 font-semibold"
                  >
                    End Exam
                  </button>
                </>
              )}

              {session.status === 'paused' && (
                <button
                  onClick={handleResume}
                  className="w-full px-4 py-3 bg-green-600 rounded-lg hover:bg-green-700 font-semibold"
                >
                  Resume Exam
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={previousImage}
                  disabled={currentCaseIndex === 0 && currentImageIndex === 0}
                  className="flex-1 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  ← Previous
                </button>
                <button
                  onClick={nextImage}
                  className="flex-1 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 font-semibold"
                >
                  Next →
                </button>
              </div>

              {/* Case Navigator */}
              {session.exam.cases.length > 1 && (
                <div className="pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-semibold mb-3">Jump to Case</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {session.exam.cases.map((caseItem, idx) => (
                      <button
                        key={idx}
                        onClick={() => navigateToImage(idx, 0)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          currentCaseIndex === idx
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                    <div key={idx} className="bg-gray-900 p-3 rounded-lg">
                      <span className="text-yellow-400 font-semibold mr-2">{idx + 1}.</span>
                      <span className="text-gray-300">{dp.point}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">
              Participants ({session.participants.length})
            </h3>
            {session.participants.length === 0 ? (
              <p className="text-sm text-gray-400">No students have joined yet</p>
            ) : (
              <div className="space-y-2">
                {session.participants.map((p, i) => (
                  <div key={i} className="text-sm text-gray-300 flex items-center gap-2 bg-gray-900 p-2 rounded">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {p.student?.firstName} {p.student?.lastName}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Students (For Examiner) */}
          {isExaminer && session.assignedStudents && session.assignedStudents.length > 0 && (
            <div className="pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold mb-3">
                Assigned Students ({session.assignedStudents.length})
              </h3>
              <div className="space-y-2">
                {session.assignedStudents.map((student, i) => (
                  <div key={i} className="text-sm text-gray-300 bg-gray-900 p-2 rounded">
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
