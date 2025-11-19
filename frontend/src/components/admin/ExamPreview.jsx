import { useState, useEffect } from 'react'
import axios from 'axios'

export default function ExamPreview({ examId, onClose }) {
  const [exam, setExam] = useState(null)
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExamDetails()
  }, [examId])

  const fetchExamDetails = async () => {
    try {
      const response = await axios.get(`/api/exams/${examId}`)
      setExam(response.data.exam)
    } catch (error) {
      console.error('Error fetching exam details:', error)
      alert('Failed to load exam preview')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const currentCase = exam?.cases[currentCaseIndex]
  const currentImage = currentCase?.images[currentImageIndex]
  const totalImages = currentCase?.images.length || 0
  const totalCases = exam?.cases.length || 0

  const nextCase = () => {
    if (currentCaseIndex < totalCases - 1) {
      setCurrentCaseIndex(currentCaseIndex + 1)
      setCurrentImageIndex(0)
    }
  }

  const prevCase = () => {
    if (currentCaseIndex > 0) {
      setCurrentCaseIndex(currentCaseIndex - 1)
      setCurrentImageIndex(0)
    }
  }

  const goToCase = (caseIndex) => {
    setCurrentCaseIndex(caseIndex)
    setCurrentImageIndex(0)
  }

  const isFirstCase = currentCaseIndex === 0
  const isLastCase = currentCaseIndex === totalCases - 1

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p className="text-lg">Loading exam preview...</p>
        </div>
      </div>
    )
  }

  if (!exam) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-xl font-bold">{exam.title} - Preview Mode</h2>
              <p className="text-sm text-indigo-100">Duration: {exam.duration} minutes | {totalCases} cases | {exam.cases.reduce((sum, c) => sum + c.images.length, 0)} images</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Timeline Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-indigo-100">Progress:</span>
              <div className="flex-1 bg-indigo-800 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-300"
                  style={{
                    width: `${((currentCaseIndex * totalImages + currentImageIndex + 1) / exam.cases.reduce((sum, c) => sum + c.images.length, 0)) * 100}%`
                  }}
                />
              </div>
              <span className="text-xs font-medium text-indigo-100">
                {currentCaseIndex + 1}/{totalCases} cases
              </span>
            </div>

            {/* Mini timeline */}
            <div className="flex gap-1">
              {exam.cases.map((caseItem, idx) => (
                <div
                  key={caseItem._id}
                  className={`flex-1 h-1 rounded cursor-pointer transition ${
                    idx === currentCaseIndex
                      ? 'bg-white'
                      : idx < currentCaseIndex
                      ? 'bg-indigo-300'
                      : 'bg-indigo-700'
                  }`}
                  onClick={() => goToCase(idx)}
                  title={`Case ${idx + 1}: ${caseItem.title}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Case Navigation */}
          <div className="w-64 bg-gray-50 border-r overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Cases</h3>
              <div className="space-y-2">
                {exam.cases.map((caseItem, index) => (
                  <button
                    key={caseItem._id}
                    onClick={() => goToCase(index)}
                    className={`w-full text-left p-3 rounded transition ${
                      index === currentCaseIndex
                        ? 'bg-indigo-100 border-2 border-indigo-500'
                        : 'bg-white border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium text-sm">Case {index + 1}</div>
                    <div className="text-xs text-gray-600 truncate">{caseItem.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {caseItem.images.length} images
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Display Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Case Info */}
            <div className="bg-gray-100 border-b px-6 py-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Case {currentCaseIndex + 1}: {currentCase?.title}
                  </h3>
                  <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-1">Clinical History:</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {currentCase?.clinicalHistory}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Display */}
            <div className="flex-1 bg-gray-900 p-6 overflow-auto">
              {currentCase?.images && currentCase.images.length > 0 ? (
                <div className="flex flex-col gap-6 items-center min-h-full justify-center">
                  {currentCase.images.map((image, idx) => (
                    <div key={idx} className="max-w-full flex flex-col items-center">
                      <img
                        src={`/${image.path}`}
                        alt={image.originalName}
                        className="max-w-full max-h-[70vh] object-contain rounded shadow-lg"
                      />
                      <p className="text-white text-sm mt-3 bg-gray-800 px-4 py-2 rounded">
                        Image {idx + 1} of {currentCase.images.length}: {image.originalName}
                      </p>
                      {image.description && (
                        <p className="text-gray-300 text-xs mt-1 italic">
                          {image.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-white">No images available</p>
                </div>
              )}
            </div>

            {/* Navigation Controls */}
            <div className="bg-gray-100 border-t px-6 py-4">
              <div className="flex justify-between items-center">
                <button
                  onClick={prevCase}
                  disabled={isFirstCase}
                  className={`px-4 py-2 rounded font-medium ${
                    isFirstCase
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  ← Previous Case
                </button>

                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Case {currentCaseIndex + 1} of {totalCases}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalImages} images in this case | Scroll to view all
                  </p>
                </div>

                <button
                  onClick={nextCase}
                  disabled={isLastCase}
                  className={`px-4 py-2 rounded font-medium ${
                    isLastCase
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  Next Case →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
