import { useEffect, useRef, useState } from 'react'
import * as cornerstone from 'cornerstone-core'
import * as cornerstoneTools from 'cornerstone-tools'
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader'
import Hammer from 'hammerjs'

// Initialize Cornerstone Tools
cornerstoneTools.external.cornerstone = cornerstone
cornerstoneTools.external.Hammer = Hammer

export default function DicomViewer({
  images = [],
  currentImageIndex = 0,
  onImageChange,
  caseId,
  isExaminer = false,
  onAnnotationChange,
  initialAnnotations = [],
  className = ''
}) {
  const elementRef = useRef(null)
  const [initialized, setInitialized] = useState(false)
  const [activeTool, setActiveTool] = useState(null)
  const [currentSeries, setCurrentSeries] = useState([])
  const [seriesIndex, setSeriesIndex] = useState(0)
  const imageIdsRef = useRef([])
  const annotationsRef = useRef([])

  // Group images by series
  useEffect(() => {
    if (!images || images.length === 0) return

    // Check if we have a DICOM series (multiple images with seriesId)
    const seriesImages = images.filter(img => img.isDicom)

    if (seriesImages.length > 1) {
      // Group by seriesId
      const seriesMap = {}
      seriesImages.forEach(img => {
        const sid = img.seriesId || 'default'
        if (!seriesMap[sid]) {
          seriesMap[sid] = []
        }
        seriesMap[sid].push(img)
      })

      // Sort each series by instance number
      Object.values(seriesMap).forEach(series => {
        series.sort((a, b) => (a.instanceNumber || 0) - (b.instanceNumber || 0))
      })

      // For now, use the first series (or could let user select)
      const firstSeries = Object.values(seriesMap)[0] || []
      setCurrentSeries(firstSeries)
      setSeriesIndex(0)
    } else if (images.length === 1 && images[0].isDicom) {
      setCurrentSeries([images[0]])
      setSeriesIndex(0)
    } else {
      setCurrentSeries([])
    }
  }, [images])

  // Initialize Cornerstone on the element
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    try {
      cornerstone.enable(element)
      setInitialized(true)

      // Initialize tools
      cornerstoneTools.init({
        mouseEnabled: true,
        touchEnabled: true,
        globalToolSyncEnabled: false,
        showSVGCursors: false
      })

      // Add tools
      cornerstoneTools.addTool(cornerstoneTools.PanTool)
      cornerstoneTools.addTool(cornerstoneTools.ZoomTool)
      cornerstoneTools.addTool(cornerstoneTools.WwwcTool)
      cornerstoneTools.addTool(cornerstoneTools.LengthTool)
      cornerstoneTools.addTool(cornerstoneTools.AngleTool)
      cornerstoneTools.addTool(cornerstoneTools.EllipticalRoiTool)
      cornerstoneTools.addTool(cornerstoneTools.RectangleRoiTool)
      cornerstoneTools.addTool(cornerstoneTools.FreehandRoiTool)
      cornerstoneTools.addTool(cornerstoneTools.ArrowAnnotateTool)
      cornerstoneTools.addTool(cornerstoneTools.StackScrollMouseWheelTool)

      // Activate default tools
      cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 }) // Left click for windowing
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 4 }) // Middle click for pan
      cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 2 }) // Right click for zoom
      cornerstoneTools.setToolActive('StackScrollMouseWheel', {}) // Mouse wheel for scrolling

      return () => {
        try {
          cornerstone.disable(element)
        } catch (e) {
          console.error('Error disabling cornerstone:', e)
        }
      }
    } catch (error) {
      console.error('Error initializing Cornerstone:', error)
    }
  }, [])

  // Load images when series changes
  useEffect(() => {
    if (!initialized || !currentSeries.length) return

    const loadSeriesImages = async () => {
      const baseUrl = import.meta.env.VITE_API_URL || window.location.origin
      const imageIds = currentSeries.map(img => {
        const imagePath = img.path.startsWith('/') ? img.path.slice(1) : img.path
        return `wadouri:${baseUrl}/${imagePath}`
      })

      imageIdsRef.current = imageIds

      if (imageIds.length > 0) {
        try {
          const element = elementRef.current
          const image = await cornerstone.loadImage(imageIds[0])
          cornerstone.displayImage(element, image)

          // Set up stack for scrolling
          const stack = {
            currentImageIdIndex: 0,
            imageIds: imageIds
          }
          cornerstoneTools.addStackStateManager(element, ['stack'])
          cornerstoneTools.addToolState(element, 'stack', stack)
        } catch (error) {
          console.error('Error loading DICOM series:', error)
        }
      }
    }

    loadSeriesImages()
  }, [initialized, currentSeries])

  // Load single DICOM image
  useEffect(() => {
    if (!initialized || !elementRef.current) return
    if (currentSeries.length > 0) return // Series handled above

    const currentImage = images[currentImageIndex]
    if (!currentImage?.isDicom) return

    const loadImage = async () => {
      try {
        const element = elementRef.current
        const baseUrl = import.meta.env.VITE_API_URL || window.location.origin
        const imagePath = currentImage.path.startsWith('/') ? currentImage.path.slice(1) : currentImage.path
        const imageId = `wadouri:${baseUrl}/${imagePath}`

        const image = await cornerstone.loadImage(imageId)
        cornerstone.displayImage(element, image)
      } catch (error) {
        console.error('Error loading DICOM image:', error)
      }
    }

    loadImage()
  }, [initialized, currentImageIndex, images, currentSeries])

  // Handle tool selection
  const selectTool = (toolName) => {
    if (!initialized) return

    // Deactivate previous tool
    if (activeTool) {
      cornerstoneTools.setToolPassive(activeTool)
    }

    // Activate new tool
    if (toolName) {
      cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 })
      setActiveTool(toolName)
    } else {
      setActiveTool(null)
    }
  }

  // Save annotation
  const saveAnnotation = () => {
    if (!elementRef.current || !onAnnotationChange) return

    const element = elementRef.current
    const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState()

    if (onAnnotationChange) {
      onAnnotationChange({
        caseId,
        imageIndex: currentImageIndex,
        seriesId: currentSeries[seriesIndex]?.seriesId,
        instanceNumber: currentSeries[seriesIndex]?.instanceNumber,
        toolData: toolState
      })
    }
  }

  // Listen for tool changes
  useEffect(() => {
    if (!initialized || !elementRef.current) return

    const element = elementRef.current
    const handleToolChange = () => {
      saveAnnotation()
    }

    element.addEventListener('cornerstonetoolsmeasurementadded', handleToolChange)
    element.addEventListener('cornerstonetoolsmeasurementmodified', handleToolChange)
    element.addEventListener('cornerstonetoolsmeasurementremoved', handleToolChange)

    return () => {
      element.removeEventListener('cornerstonetoolsmeasurementadded', handleToolChange)
      element.removeEventListener('cornerstonetoolsmeasurementmodified', handleToolChange)
      element.removeEventListener('cornerstonetoolsmeasurementremoved', handleToolChange)
    }
  }, [initialized, currentImageIndex, currentSeries, seriesIndex])

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400">
        No images to display
      </div>
    )
  }

  const currentImage = images[currentImageIndex]
  if (!currentImage?.isDicom) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800">
        <img
          src={`/${currentImage.path}`}
          alt="Medical image"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar */}
      {isExaminer && (
        <div className="bg-gray-800 p-3 border-b border-gray-700 flex gap-2 flex-wrap">
          <button
            onClick={() => selectTool(null)}
            className={`px-3 py-1 rounded text-sm ${
              !activeTool ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Window/Level
          </button>
          <button
            onClick={() => selectTool('EllipticalRoi')}
            className={`px-3 py-1 rounded text-sm ${
              activeTool === 'EllipticalRoi' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Circle ROI"
          >
            ⭕ Circle
          </button>
          <button
            onClick={() => selectTool('ArrowAnnotate')}
            className={`px-3 py-1 rounded text-sm ${
              activeTool === 'ArrowAnnotate' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Arrow"
          >
            ➡️ Arrow
          </button>
          <button
            onClick={() => selectTool('RectangleRoi')}
            className={`px-3 py-1 rounded text-sm ${
              activeTool === 'RectangleRoi' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Rectangle ROI"
          >
            ▭ Rectangle
          </button>
          <button
            onClick={() => selectTool('Length')}
            className={`px-3 py-1 rounded text-sm ${
              activeTool === 'Length' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Measure Length"
          >
            📏 Length
          </button>
          <button
            onClick={() => selectTool('Angle')}
            className={`px-3 py-1 rounded text-sm ${
              activeTool === 'Angle' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Measure Angle"
          >
            📐 Angle
          </button>
          <button
            onClick={() => selectTool('FreehandRoi')}
            className={`px-3 py-1 rounded text-sm ${
              activeTool === 'FreehandRoi' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Freehand Drawing"
          >
            ✏️ Freehand
          </button>
        </div>
      )}

      {/* DICOM Viewer */}
      <div
        ref={elementRef}
        className="flex-1 bg-black"
        style={{ minHeight: '400px' }}
      />

      {/* Series info */}
      {currentSeries.length > 1 && (
        <div className="bg-gray-800 p-2 border-t border-gray-700 text-center text-sm text-gray-400">
          Image {seriesIndex + 1} of {currentSeries.length} - Use mouse wheel to scroll through series
        </div>
      )}
    </div>
  )
}
