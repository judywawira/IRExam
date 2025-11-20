import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import * as cornerstone from 'cornerstone-core'
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader'
import dicomParser from 'dicom-parser'

// Initialize Cornerstone DICOM loader
cornerstoneWADOImageLoader.external.cornerstone = cornerstone
cornerstoneWADOImageLoader.external.dicomParser = dicomParser

export default function ExamSession() {
  const { sessionId } = useParams()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const dicomElementRef = useRef(null)

  const [session, setSession] = useState(null)
  const [currentCase, setCurrentCase] = useState(null)
  const [currentImage, setCurrentImage] = useState(null)
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [status, setStatus] = useState('scheduled')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('history') // 'history', 'image', or 'transition'
  const [showTransition, setShowTransition] = useState(false)

  const isExaminer = user.role === 'examiner' || user.role === 'admin'
  const isRunning = status === 'active'

  useEffect(() => {
    fetchSession()
    setupSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [sessionId])

  // Timer effect - only for examiner
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

  // Load DICOM image when currentImage changes
  useEffect(() => {
    if (currentImage && dicomElementRef.current) {
      loadDicomImage()
    }
  }, [currentImage])

  const loadDicomImage = async () => {
    if (!currentImage || !dicomElementRef.current) return

    const isDicom = currentImage.path.toLowerCase().endsWith('.dcm') ||
                    currentImage.path.toLowerCase().includes('.dicom')

    if (isDicom) {
      try {
        const element = dicomElementRef.current
        cornerstone.enable(element)

        const baseUrl = import.meta.env.VITE_API_URL || window.location.origin
        const imageId = `wadouri:${baseUrl}/${currentImage.path}`
        const image = await cornerstone.loadImage(imageId)
        cornerstone.displayImage(element, image)
      } catch (error) {
        console.error('Error loading DICOM image:', error)
      }
    }
  }

  const fetchSession = async () => {
    try {
      const response = await axios.get(`/api/sessions/${sessionId}`)
      const sessionData = response.data.session
      setSession(sessionData)
      setStatus(sessionData.status)
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
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin
    socketRef.current = io(socketUrl, {
      auth: { token }
    })

    socketRef.current.emit('join-session', sessionId)

    // Handle session state updates
    socketRef.current.on('session-state', (data) => {
      setTimeRemaining(data.timeRemaining)
      setStatus(data.status)
      setCurrentCaseIndex(data.currentCaseIndex)
      setCurrentImageIndex(data.currentImageIndex)
      updateCurrentDisplay(data.exam, data.currentCaseIndex, data.currentImageIndex)

      // Set initial view mode based on state
      if (data.currentImageIndex > 0 || (data.currentCaseIndex > 0 && data.currentImageIndex === 0)) {
        setViewMode('image')
      } else {
        setViewMode('history')
      }
    })

    socketRef.current.on('exam-started', (data) => {
      setStatus('active')
    })

    socketRef.current.on('exam-paused', () => {
      setStatus('paused')
    })

    socketRef.current.on('exam-resumed', () => {
      setStatus('active')
    })

    socketRef.current.on('exam-ended', () => {
      setStatus('completed')
      alert('Exam has ended. Returning to dashboard...')
      setTimeout(() => navigate('/'), 1500)
    })

    socketRef.current.on('image-changed', ({ caseIndex, imageIndex }) => {
      // Show transition for students when changing cases
      if (caseIndex !== currentCaseIndex && !isExaminer) {
        setShowTransition(true)
        setViewMode('transition')

        setTimeout(() => {
          setCurrentCaseIndex(caseIndex)
          setCurrentImageIndex(imageIndex)
          if (session?.exam) {
            updateCurrentDisplay(session.exam, caseIndex, imageIndex)
          }
          setShowTransition(false)
          setViewMode(imageIndex === 0 ? 'history' : 'image')
        }, 2000)
      } else {
        setCurrentCaseIndex(caseIndex)
        setCurrentImageIndex(imageIndex)
        if (session?.exam) {
          updateCurrentDisplay(session.exam, caseIndex, imageIndex)
        }
        setViewMode(imageIndex === 0 ? 'history' : 'image')
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
    if (!session?.exam?.cases) return
    const caseData = session.exam.cases[caseIndex]
    if (!caseData || !caseData.images[imageIndex]) return

    // Emit socket event - will be broadcast to all participants including this examiner
    socketRef.current.emit('navigate-image', {
      sessionId,
      caseIndex,
      imageIndex
    })
  }

  const showHistory = (caseIndex) => {
    if (!session?.exam?.cases) return

    // Navigate to first "image" of the case which triggers history view
    navigateToImage(caseIndex, 0)
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

  const isDicomFile = (imagePath) => {
    if (!imagePath) return false
    return imagePath.toLowerCase().endsWith('.dcm') || imagePath.toLowerCase().includes('.dicom')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Session not found</div>
  }

  // STUDENT VIEW - Full Screen Presentation
  if (!isExaminer) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Simple Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">{session.name}</h1>
              <p className="text-sm text-gray-400">
                {status === 'scheduled' && 'Session will begin shortly...'}
                {status === 'active' && 'Exam in Progress'}
                {status === 'paused' && 'Exam Paused'}
                {status === 'completed' && 'Exam Completed'}
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

        {/* Full Screen Content Area */}
        <div className="h-[calc(100vh-80px)] flex items-center justify-center p-6">
          {status === 'scheduled' && (
            <div className="text-center">
              <div className="mb-8">
                <svg className="w-32 h-32 mx-auto text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">Waiting to Start</h2>
              <p className="text-xl text-gray-400">Your examiner will begin the session shortly...</p>
            </div>
          )}

          {status !== 'scheduled' && viewMode === 'transition' && (
            <div className="text-center animate-fade-in">
              <div className="mb-8">
                <svg className="w-32 h-32 mx-auto text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">Moving to Next Case</h2>
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}

          {status !== 'scheduled' && viewMode === 'history' && currentCase && (
            <div className="max-w-5xl w-full">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20">
                <div className="bg-white/5 rounded-xl p-8 border border-white/10">
                  <h4 className="text-2xl font-semibold text-blue-400 mb-6">Clinical History</h4>
                  <p className="text-gray-200 text-xl leading-relaxed whitespace-pre-wrap">
                    {currentCase.clinicalHistory}
                  </p>
                </div>
              </div>
            </div>
          )}

          {status !== 'scheduled' && viewMode === 'image' && currentImage && (
            <div className="w-full max-w-6xl">
              {isDicomFile(currentImage.path) ? (
                <div
                  ref={dicomElementRef}
                  className="w-full h-[80vh] bg-black rounded-lg"
                  style={{ minHeight: '600px' }}
                />
              ) : (
                <img
                  src={`/${currentImage.path}`}
                  alt="Medical image"
                  className="w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-2xl mx-auto"
                />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // EXAMINER VIEW
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{session.name}</h1>
            <p className="text-sm text-gray-400">
              Examiner View - {status === 'scheduled' ? 'Not Started' : status === 'active' ? 'In Progress' : status === 'paused' ? 'Paused' : 'Completed'}
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
          {/* Clinical History View */}
          {viewMode === 'history' && currentCase && (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-900 rounded-lg p-12">
              <div className="max-w-4xl w-full">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold text-blue-300 mb-2">
                      Case {currentCaseIndex + 1}
                    </h2>
                    <h3 className="text-2xl font-semibold text-white">
                      {currentCase.title}
                    </h3>
                  </div>
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h4 className="text-lg font-semibold text-blue-400 mb-4">Clinical History</h4>
                    <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                      {currentCase.clinicalHistory}
                    </p>
                  </div>
                  <div className="mt-6 text-center">
                    <p className="text-gray-400 text-sm">
                      Click on image thumbnails below to view images →
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Display View */}
          {viewMode === 'image' && (
            <div className="flex-1 flex flex-col">
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-blue-400">
                  Case {currentCaseIndex + 1}: {currentCase?.title}
                </h3>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-lg p-6">
                {currentImage ? (
                  <div className="w-full">
                    {isDicomFile(currentImage.path) ? (
                      <div>
                        <div
                          ref={dicomElementRef}
                          className="w-full h-[60vh] bg-black rounded-lg"
                          style={{ minHeight: '500px' }}
                        />
                        <div className="text-center mt-4">
                          <p className="text-gray-400">
                            Case {currentCaseIndex + 1} / {session.exam.cases.length} -
                            Image {currentImageIndex + 1} / {currentCase?.images.length}
                          </p>
                          <p className="text-sm text-blue-400 mt-2">DICOM Image</p>
                          {currentImage.description && (
                            <p className="mt-2 text-gray-500 text-sm italic">
                              {currentImage.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <img
                          src={`/${currentImage.path}`}
                          alt={currentImage.originalName}
                          className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg mx-auto"
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
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">No image to display</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thumbnails for Examiners */}
          {isExaminer && currentCase && (
            <div className="bg-gray-800 rounded-lg p-6 mt-4">
              <h4 className="text-sm font-semibold mb-4 text-gray-300">
                Case {currentCaseIndex + 1} - Click to navigate
              </h4>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {/* Clinical History Thumbnail */}
                <button
                  onClick={() => showHistory(currentCaseIndex)}
                  className={`relative aspect-square rounded-lg overflow-hidden transition-all transform hover:scale-105 ${
                    viewMode === 'history'
                      ? 'ring-4 ring-blue-500 shadow-lg shadow-blue-500/50'
                      : 'ring-1 ring-gray-600 hover:ring-2 hover:ring-gray-400'
                  }`}
                  title="Clinical History"
                >
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-2">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <span className="absolute bottom-1 left-1 right-1 bg-black/90 text-white text-xs px-1 py-1 rounded font-semibold text-center">
                    History
                  </span>
                </button>

                {/* Image Thumbnails */}
                {currentCase.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigateToImage(currentCaseIndex, idx)}
                    className={`relative aspect-square rounded-lg overflow-hidden transition-all transform hover:scale-105 ${
                      viewMode === 'image' && currentImageIndex === idx
                        ? 'ring-4 ring-blue-500 shadow-lg shadow-blue-500/50'
                        : 'ring-1 ring-gray-600 hover:ring-2 hover:ring-gray-400'
                    }`}
                    title={`Image ${idx + 1}${img.description ? ': ' + img.description : ''}`}
                  >
                    {isDicomFile(img.path) ? (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    ) : (
                      <img
                        src={`/${img.path}`}
                        alt={`Image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute bottom-1 right-1 bg-black/90 text-white text-xs px-2 py-1 rounded font-semibold">
                      {idx + 1}
                    </span>
                    {isDicomFile(img.path) && (
                      <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold">
                        DCM
                      </span>
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
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold">Controls</h3>

            {status === 'scheduled' && (
              <button
                onClick={handleStart}
                className="w-full px-4 py-3 bg-green-600 rounded-lg hover:bg-green-700 font-semibold"
              >
                Start Exam
              </button>
            )}

            {status === 'active' && (
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

            {status === 'paused' && (
              <>
                <button
                  onClick={handleResume}
                  className="w-full px-4 py-3 bg-green-600 rounded-lg hover:bg-green-700 font-semibold"
                >
                  Resume Exam
                </button>
                <button
                  onClick={handleEnd}
                  className="w-full px-4 py-3 bg-red-600 rounded-lg hover:bg-red-700 font-semibold"
                >
                  End Exam
                </button>
              </>
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
                      onClick={() => showHistory(idx)}
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

          {/* Discussion Points */}
          {currentCase && currentCase.discussionPoints && currentCase.discussionPoints.length > 0 && (
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

          {/* Assigned Students */}
          {session.assignedStudents && session.assignedStudents.length > 0 && (
            <div>
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
