'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, RotateCcw, Save, ZoomIn, ZoomOut, Copy, Trash2, Crop, Sliders, Wand2, Scissors, Undo, Redo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import Image from 'next/image'
import supabase from '../config/supabaseClient'

const EditImage = ({ editInfo, setEditState, setEditInfo, onSave, onDelete , onDuplicate}) => {


  
  const canvasRef = useRef(null)
  const canvasContainerRef = useRef(null)
  const centerRef = useRef(null)
  const [zoom, setZoom] = useState(100)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [activeTool, setActiveTool] = useState('crop')
  const [originalImage, setOriginalImage] = useState(null)
  const [editedImage, setEditedImage] = useState(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [bgThreshold, setBgThreshold] = useState(60)
  // Object eraser states
  const [brushSize, setBrushSize] = useState(20)
  const [eraserStrength, setEraserStrength] = useState(100)
  const canvasHistoryRef = useRef([]) // stores canvas states for undo/redo
  const originalImageHistoryRef = useRef([]) // stores originalImage states for undo/redo
  const stateHistoryRef = useRef([]) // stores other state for undo/redo
  const historyIndexRef = useRef(-1)
  const erasingRef = useRef(false)
  const activeToolRef = useRef('crop') // track active tool without triggering effects
  const skipRedrawRef = useRef(false) // flag to skip redraw effect when using eraser
  const [replaceImage, setReplaceImage] = useState(false) // checkbox to replace existing image on save

  // Crop state
  const [cropRect, setCropRect] = useState(null) // { x, y, width, height } in canvas pixels
  const [isDraggingCrop, setIsDraggingCrop] = useState(false)
  const [dragHandle, setDragHandle] = useState(null) // 'move' | 'nw' | 'ne' | 'sw' | 'se'
  const [aspectRatio, setAspectRatio] = useState(null) // null = free, or number width/height
  const draggingRef = useRef(null) // { startX, startY, origRect }
  const userInteractingCropRef = useRef(false)
  const suppressAutoZoomTimeoutRef = useRef(null)
  const [cropDimensionWidth, setCropDimensionWidth] = useState('') // manual width input
  const [cropDimensionHeight, setCropDimensionHeight] = useState('') // manual height input

    // Image name editing
    const [imageName, setImageName] = useState('') // editable image name
    const [isEditingName, setIsEditingName] = useState(false) // toggle name edit mode
    const [tempName, setTempName] = useState('') // temp name during edit


    // Load image on mount and initialize name
    useEffect(() => {
      console.log('EditImage render', editInfo)
      if (editInfo?.url) {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.src = editInfo.url
        img.onload = () => {
          setOriginalImage(img)
          setEditedImage(img)
          // Initialize image name from editInfo
        setImageName(editInfo.name || 'Untitled Image')
      }
    }
  }, [editInfo, editInfo?.name])

  // Save initial state to history when image loads
  useEffect(() => {
    if (originalImage && canvasRef.current) {
      // Initialize crop rect to full image
      setCropRect({ x: 0, y: 0, width: originalImage.width, height: originalImage.height })
      setCropDimensionWidth(String(originalImage.width))
      setCropDimensionHeight(String(originalImage.height))
      // Save initial state
      setTimeout(() => pushCanvasHistory(), 100) // delay to ensure canvas is rendered
    }
  }, [originalImage])

  // Apply filters to canvas
  useEffect(() => {
    if (skipRedrawRef.current) {
      skipRedrawRef.current = false
      return
    }
    if (canvasRef.current && originalImage) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      // Set canvas size
      canvas.width = originalImage.width
      canvas.height = originalImage.height

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Apply transforms
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)

      // Apply filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`

      // Draw image
      ctx.drawImage(originalImage, 0, 0)
      ctx.restore()

      // Update editedImage to reflect current canvas (so background replace works on latest pixels)
      try {
        const dataUrl = canvas.toDataURL('image/png')
        const img2 = new window.Image()
        img2.crossOrigin = 'anonymous'
        img2.onload = () => setEditedImage(img2)
        img2.src = dataUrl
      } catch (e) {
        // ignore tainted canvas errors here
      }

      // Initialize crop rect to full image if not set
      setCropRect((prev) => prev || { x: 0, y: 0, width: canvas.width, height: canvas.height })

      // Set default dimension inputs to current image size
      setCropDimensionWidth(String(canvas.width))
      setCropDimensionHeight(String(canvas.height))

      // Try to fit canvas to viewport (but not when using object eraser to preserve zoom)
      if (activeToolRef.current !== 'object-eraser') {
        setTimeout(() => {
          try {
            fitToViewport()
          } catch (e) {}
        }, 0)
      }

      // Save canvas state to history after filters/transforms are applied (after DOM updates)
      // Use requestAnimationFrame to ensure canvas is fully rendered
      requestAnimationFrame(() => {
        setTimeout(() => pushCanvasHistory(), 0)
      })
    }
  }, [originalImage])

  const pushCanvasHistory = () => {
    if (!canvasRef.current || !originalImage) return
    try {
      // Save snapshot before any operation
      const snapshot = canvasRef.current.toDataURL('image/png')
      // Remove any redo history beyond current index
      canvasHistoryRef.current = canvasHistoryRef.current.slice(0, historyIndexRef.current + 1)
      originalImageHistoryRef.current = originalImageHistoryRef.current.slice(0, historyIndexRef.current + 1)
      stateHistoryRef.current = stateHistoryRef.current.slice(0, historyIndexRef.current + 1)
      // Add new snapshot
      canvasHistoryRef.current.push(snapshot)
      originalImageHistoryRef.current.push(originalImage)
      stateHistoryRef.current.push({
        brightness,
        contrast,
        saturation,
        rotation,
        cropRect,
        cropDimensionWidth,
        cropDimensionHeight,
        aspectRatio
      })
      historyIndexRef.current = canvasHistoryRef.current.length - 1
    } catch (err) {
      console.warn('Could not save canvas history', err)
    }
  }

  const handleUndo = () => {
    if (!canvasRef.current || !canvasHistoryRef.current.length) return
    if (historyIndexRef.current <= 0) {
      toast('Nothing to undo')
      return
    }
    historyIndexRef.current -= 1
    const snapshot = canvasHistoryRef.current[historyIndexRef.current]
    const origImg = originalImageHistoryRef.current[historyIndexRef.current]
    const state = stateHistoryRef.current[historyIndexRef.current]
    if (!snapshot || !origImg || !state) return
    
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      // Restore states
      setOriginalImage(origImg)
      setBrightness(state.brightness)
      setContrast(state.contrast)
      setSaturation(state.saturation)
      setRotation(state.rotation)
      setCropRect(state.cropRect)
      setCropDimensionWidth(state.cropDimensionWidth)
      setCropDimensionHeight(state.cropDimensionHeight)
      setAspectRatio(state.aspectRatio)
    }
    img.onerror = () => {
      console.warn('Failed to load undo snapshot')
      historyIndexRef.current += 1 // revert index on error
    }
    img.src = snapshot
    toast('Undo')
  }

  const handleRedo = () => {
    if (!canvasRef.current || !canvasHistoryRef.current.length) return
    if (historyIndexRef.current >= canvasHistoryRef.current.length - 1) {
      toast('Nothing to redo')
      return
    }
    historyIndexRef.current += 1
    const snapshot = canvasHistoryRef.current[historyIndexRef.current]
    const origImg = originalImageHistoryRef.current[historyIndexRef.current]
    const state = stateHistoryRef.current[historyIndexRef.current]
    if (!snapshot || !origImg || !state) return
    
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      // Restore states
      setOriginalImage(origImg)
      setBrightness(state.brightness)
      setContrast(state.contrast)
      setSaturation(state.saturation)
      setRotation(state.rotation)
      setCropRect(state.cropRect)
      setCropDimensionWidth(state.cropDimensionWidth)
      setCropDimensionHeight(state.cropDimensionHeight)
      setAspectRatio(state.aspectRatio)
    }
    img.onerror = () => {
      console.warn('Failed to load redo snapshot')
      historyIndexRef.current -= 1 // revert index on error
    }
    img.src = snapshot
    toast('Redo')
  }

  const handleReset = () => {
    ;(async () => {
      try {
        // Reset visual controls
        setBrightness(100)
        setContrast(100)
        setSaturation(100)
        setRotation(0)
        setZoom(100)

        // Clear history
        canvasHistoryRef.current = []
        historyIndexRef.current = -1

        // Reload original image from source URL if available
        if (editInfo && editInfo.url) {
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = editInfo.url })
          setOriginalImage(img)
          setEditedImage(img)
          // reset crop to full image
          setCropRect({ x: 0, y: 0, width: img.width, height: img.height })
          setCropDimensionWidth(String(img.width))
          setCropDimensionHeight(String(img.height))
          setAspectRatio(null)
          setImageName(editInfo.name || '')
          // fit viewport to reset zoom (after state updates)
          setTimeout(() => fitToViewport(), 20)
          toast('Reverted to original image')
        } else {
          toast('Reset controls to defaults')
        }
      } catch (err) {
        console.error('Could not revert to original image', err)
        toast.error ? toast.error('Failed to revert to original image') : toast('Failed to revert to original image')
      }
    })()
  }


async function generateNextNumberedName(companyName, fileName) {
  // Ensure we always return a value. Preserve file extension if present.
  const t = toast.loading(`checking if Name already exists...`);
  try {
    const { data: images, error } = await supabase
      .from("images")
      .select("name")
      .eq("companyName", companyName);

    if (error) {
      toast.error("Error checking existing image names", { id: t });
      // Fallback: append (1) before extension
      const dot = fileName.lastIndexOf('.')
      const base = dot > 0 ? fileName.slice(0, dot) : fileName
      const ext = dot > 0 ? fileName.slice(dot) : ''
      const fallback = `${base} (1)${ext}`
      toast.success(`Renamed to "${fallback}"`, { id: t })
      return fallback
    }

    const existingNames = Array.isArray(images) ? images.map(img => img.name || '') : []

    const dot = fileName.lastIndexOf('.')
    const baseWithExt = dot > 0 ? fileName.slice(0, dot) : fileName
    const ext = dot > 0 ? fileName.slice(dot) : ''

    // Check if the base name already ends with a number in parentheses
    const parenMatch = baseWithExt.match(/^(.*)\s*\((\d+)\)$/)
    let base = baseWithExt
    let startNum = 1

    if (parenMatch) {
      // If it already has a number, use that as the base and start from that number + 1
      base = parenMatch[1].trim()
      startNum = parseInt(parenMatch[2]) + 1
    }

    let n = startNum
    let newName = `${base} (${n})${ext}`

    // Keep incrementing until a unique full name (including extension) is found
    // Safety cap to avoid infinite loops
    while (existingNames.includes(newName) && n < 10000) {
      n++
      newName = `${base} (${n})${ext}`
    }

    toast.success(`Renamed to "${newName}"`, { id: t })
    return newName
  } catch (err) {
    console.error('generateNextNumberedName error', err)
    toast.error('Error generating unique name', { id: t })
    const dot = fileName.lastIndexOf('.')
    const base = dot > 0 ? fileName.slice(0, dot) : fileName
    const ext = dot > 0 ? fileName.slice(dot) : ''
    return `${base} (1)${ext}`
  }
}

async function doesImageNameExist(companyName, fileName) {
  try {
    const { data: images, error } = await supabase
      .from("images")
      .select("name")
      .eq("companyName", companyName);

    if (error) {
      console.error('Error checking if image name exists:', error);
      return false; // Assume it doesn't exist if we can't check
    }

    const existingNames = Array.isArray(images) ? images.map(img => img.name || '') : []
    
    // Check if the exact name exists (including extension)
    return existingNames.includes(fileName);
  } catch (err) {
    console.error('doesImageNameExist error:', err);
    return false; // Assume it doesn't exist if there's an error
  }
}


const handleSave = async () => {
  if (!canvasRef.current) return;

  try {
    const blob = await new Promise((resolve) =>
      canvasRef.current.toBlob(resolve, "image/png")
    );

    if (!blob) {
      toast.error("Failed to process image");
      return;
    }

    const originalName = editInfo.name;
    const userProvidedName = imageName || originalName;
    let finalName = userProvidedName;

    // --- CASE 1 ---
    // Name unchanged + NOT replacing → force rename
    if (userProvidedName === originalName && !replaceImage) {
      finalName = await generateNextNumberedName(editInfo.companyName, userProvidedName);
    }

    // --- CASE 2 ---
    // Name changed + NOT replacing → check if name exists (ignore extension)
    else if (userProvidedName !== originalName && !replaceImage) {
      const exists = await doesImageNameExist(editInfo.companyName, userProvidedName);

      if (exists) {
        const t = toast.loading(`"${userProvidedName}" already exists — renaming...`);
        finalName = await generateNextNumberedName(editInfo.companyName, userProvidedName);
        toast.success(`Renamed to "${finalName}"`, { id: t });
      }
    }

    // --- CASE 3 ---
    // replaceImage === true → keep same name

    // Build the final file
    const file = new File([blob], finalName, { type: "image/png" });

    // Pass upward
    if (onSave) {
      await onSave(file, replaceImage, editInfo);
    }

    setEditState(false);

  } catch (err) {
    console.error(err);
    toast.error(`Save failed: ${err.message}`);
  }
};


const handleDelete = async () => {
    if (onDelete) { 
        await onDelete(editInfo);
    }
}

const handleDuplicate = async () => {
    if (onDuplicate) { 
        await onDuplicate(editInfo);
    }
}



  // Simple background removal using corner sampling + color distance threshold
  const removeBackground = async (threshold = bgThreshold) => {
    if (!canvasRef.current) return
    setIsRemovingBg(true)
    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const { width, height } = canvas
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      // sample corners (8x8) to estimate background color
      const sampleSize = 8
      const samples = []
      const pushSample = (sx, sy) => {
        for (let y = sy; y < sy + sampleSize; y++) {
          for (let x = sx; x < sx + sampleSize; x++) {
            const i = (y * width + x) * 4
            samples.push([data[i], data[i + 1], data[i + 2]])
          }
        }
      }

      pushSample(0, 0)
      pushSample(Math.max(0, width - sampleSize), 0)
      pushSample(0, Math.max(0, height - sampleSize))
      pushSample(Math.max(0, width - sampleSize), Math.max(0, height - sampleSize))

      // average samples
      const avg = samples.reduce((acc, c) => {
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; return acc
      }, [0, 0, 0]).map((v) => Math.round(v / samples.length))

      const thresholdSq = threshold * threshold

      // iterate pixels, make alpha 0 where color close to background
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - avg[0]
        const dg = data[i + 1] - avg[1]
        const db = data[i + 2] - avg[2]
        const distSq = dr * dr + dg * dg + db * db
        if (distSq <= thresholdSq) {
          // make fully transparent
          data[i + 3] = 0
        }
      }

      ctx.putImageData(imageData, 0, 0)

      // update originalImage so further edits work on new image
      await new Promise((res) => {
        const img = new window.Image()
        img.onload = () => {
          setOriginalImage(img)
          setEditedImage(img)
          res()
        }
        img.src = canvas.toDataURL('image/png')
      })

      toast('Background removed')
    } catch (err) {
      console.error('Background removal error', err)
      const msg = err && err.message ? err.message : String(err)
      if (msg.toLowerCase().includes('tainted') || msg.toLowerCase().includes('cross-origin')) {
        const help = 'Canvas is tainted by a cross-origin image. Serve the image with CORS headers or use a proxy.'
        toast.error ? toast.error(`Background removal failed: ${help}`) : toast(`Background removal failed: ${help}`)
        console.warn('Background removal hint:', help)
      } else {
        toast.error ? toast.error(`Background removal failed: ${msg}`) : toast(`Background removal failed: ${msg}`)
      }
    } finally {
      setIsRemovingBg(false)
    }
  }

  // Apply a solid color background under the current canvas image (works after background removal)
  const applyBackgroundFill = async (color) => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    // create offscreen composite
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const ox = off.getContext('2d')
    // fill background
    ox.fillStyle = color
    ox.fillRect(0, 0, w, h)
    // draw current canvas on top
    ox.drawImage(canvas, 0, 0)
    // update originalImage
    await new Promise((res) => {
      const img = new window.Image()
      img.onload = () => { setOriginalImage(img); setEditedImage(img); res() }
      img.src = off.toDataURL('image/png')
    })
    toast('Background replaced')
  }

  // Apply an image as the background (stretched to cover)
  const applyBackgroundImage = async (url) => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    const bg = new window.Image()
    bg.crossOrigin = 'anonymous'
    bg.src = url
    await new Promise((res, rej) => { bg.onload = res; bg.onerror = rej })
    const off = document.createElement('canvas')
    off.width = w; off.height = h
    const ox = off.getContext('2d')
    // draw background stretched
    ox.drawImage(bg, 0, 0, w, h)
    // draw original image on top
    ox.drawImage(canvas, 0, 0)
    await new Promise((res) => {
      const img = new window.Image()
      img.onload = () => { setOriginalImage(img); setEditedImage(img); res() }
      img.src = off.toDataURL('image/png')
    })
    toast('Background image applied')
  }

  // Fit canvas to the center viewport container (ensure canvas fits without scrolling, scale down if needed)
  const fitToViewport = () => {
    if (!canvasRef.current || (!canvasContainerRef.current && !centerRef.current)) return
    const canvas = canvasRef.current
    // prefer the inner canvas container when available (it may be sized to a percent of the parent)
    const container = canvasContainerRef.current || centerRef.current
    const padding = 40
    const availW = Math.max(100, container.clientWidth - padding)
    const availH = Math.max(100, container.clientHeight - padding)
    if (availW <= 0 || availH <= 0) return
    const scaleX = availW / canvas.width
    const scaleY = availH / canvas.height
    // Always scale down if needed to fit; allow scale up to 100% max when cropping
    const scale = Math.min(scaleX, scaleY, 1)
    setZoom(Math.floor(scale * 100))
  }

  // Update crop rect dimensions from manual input
  const handleCropDimensionChange = () => {
    if (!canvasRef.current || !cropRect) return
    const canvas = canvasRef.current
    const extra = 170 // allow crop to extend beyond image by this many pixels per side
    const maxW = canvas.width + extra * 2
    const maxH = canvas.height + extra * 2
    const w = cropDimensionWidth ? Math.min(parseInt(cropDimensionWidth) || 0, maxW) : cropRect.width
    const h = cropDimensionHeight ? Math.min(parseInt(cropDimensionHeight) || 0, maxH) : cropRect.height
    if (w > 0 && h > 0) {
      const x = Math.round((canvas.width - w) / 2)
      const y = Math.round((canvas.height - h) / 2)
      setCropRect({ x, y, width: w, height: h })
    }
  }

  const clientToCanvas = (clientX, clientY) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const cRect = canvasRef.current.getBoundingClientRect()
    const scale = cRect.width / canvasRef.current.width
    const x = Math.round((clientX - cRect.left) / scale)
    const y = Math.round((clientY - cRect.top) / scale)
    return { x, y }
  }

  const getDisplayCrop = () => {
    if (!canvasRef.current || !cropRect || !canvasContainerRef.current) return null
    const cRect = canvasRef.current.getBoundingClientRect()
    const containerRect = canvasContainerRef.current.getBoundingClientRect()
    const scale = cRect.width / canvasRef.current.width
    const left = cRect.left - containerRect.left + cropRect.x * scale
    const top = cRect.top - containerRect.top + cropRect.y * scale
    const width = cropRect.width * scale
    const height = cropRect.height * scale
    return { left, top, width, height }
  }

  // mouse handlers for crop overlay
  const onOverlayMouseDown = (e) => {
    if (!canvasRef.current) return
    e.preventDefault()
    const pos = clientToCanvas(e.clientX, e.clientY)
    const { x, y } = pos
    if (!cropRect) {
      setCropRect({ x, y, width: 0, height: 0 })
      setIsDraggingCrop(true)
      setDragHandle('se')
      draggingRef.current = { startX: x, startY: y, origRect: { x, y, width: 0, height: 0 } }
      // User has started interacting with crop — suppress automatic adjustments
      userInteractingCropRef.current = true
      if (suppressAutoZoomTimeoutRef.current) {
        clearTimeout(suppressAutoZoomTimeoutRef.current)
        suppressAutoZoomTimeoutRef.current = null
      }
      return
    }
    const th = Math.max(8, Math.round(10 * (canvasRef.current.width / canvasRef.current.getBoundingClientRect().width)))
    const within = (px, py) => Math.abs(x - px) <= th && Math.abs(y - py) <= th
    const corners = {
      nw: { px: cropRect.x, py: cropRect.y },
      ne: { px: cropRect.x + cropRect.width, py: cropRect.y },
      sw: { px: cropRect.x, py: cropRect.y + cropRect.height },
      se: { px: cropRect.x + cropRect.width, py: cropRect.y + cropRect.height }
      
    }
    for (const k of Object.keys(corners)) {
      if (within(corners[k].px, corners[k].py)) {
        setDragHandle(k)
        setIsDraggingCrop(true)
        draggingRef.current = { startX: x, startY: y, origRect: { ...cropRect } }
        userInteractingCropRef.current = true
        if (suppressAutoZoomTimeoutRef.current) { clearTimeout(suppressAutoZoomTimeoutRef.current); suppressAutoZoomTimeoutRef.current = null }
        return
      }
    }
    // midpoint handles: top (t), bottom (b), left (l), right (r)
    const midpoints = {
      t: { px: Math.round(cropRect.x + cropRect.width / 2), py: cropRect.y },
      b: { px: Math.round(cropRect.x + cropRect.width / 2), py: cropRect.y + cropRect.height },
      l: { px: cropRect.x, py: Math.round(cropRect.y + cropRect.height / 2) },
      r: { px: cropRect.x + cropRect.width, py: Math.round(cropRect.y + cropRect.height / 2) }
    }
    for (const k of Object.keys(midpoints)) {
      if (within(midpoints[k].px, midpoints[k].py)) {
        setDragHandle(k)
        setIsDraggingCrop(true)
        draggingRef.current = { startX: x, startY: y, origRect: { ...cropRect } }
        return
      }
    }
    // inside => move
    if (x >= cropRect.x && x <= cropRect.x + cropRect.width && y >= cropRect.y && y <= cropRect.y + cropRect.height) {
      setDragHandle('move')
      setIsDraggingCrop(true)
      draggingRef.current = { startX: x, startY: y, origRect: { ...cropRect } }
      userInteractingCropRef.current = true
      if (suppressAutoZoomTimeoutRef.current) { clearTimeout(suppressAutoZoomTimeoutRef.current); suppressAutoZoomTimeoutRef.current = null }
      return
    }
    // else start a new crop
    setDragHandle('se')
    setIsDraggingCrop(true)
    draggingRef.current = { startX: x, startY: y, origRect: { x, y, width: 0, height: 0 } }
    setCropRect({ x, y, width: 0, height: 0 })
  }

  const applyEraserStroke = (cx, cy) => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const r = Math.max(1, Math.round(brushSize / 2))
    
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = Math.max(0.01, Math.min(1, eraserStrength / 100))
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const onEraserPointerDown = (e) => {
    if (activeTool !== 'object-eraser' || !canvasRef.current) return
    e.preventDefault()
    const pos = clientToCanvas(e.clientX, e.clientY)
    pushCanvasHistory()
    erasingRef.current = true
    try { if (canvasRef.current.setPointerCapture) canvasRef.current.setPointerCapture(e.pointerId) } catch (err) {}
    applyEraserStroke(pos.x, pos.y)
  }

  const onEraserPointerMove = (e) => {
    if (!erasingRef.current || activeTool !== 'object-eraser' || !canvasRef.current) return
    e.preventDefault()
    const pos = clientToCanvas(e.clientX, e.clientY)
    applyEraserStroke(pos.x, pos.y)
  }

  const finalizeEraser = async () => {
    if (!canvasRef.current) return
    erasingRef.current = false
    try {
      // update originalImage/editedImage so subsequent ops use the new pixels
      skipRedrawRef.current = true // prevent the big effect from redrawing over our erased work
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl })
      setOriginalImage(img)
      setEditedImage(img)
    } catch (err) {
      console.warn('Could not finalize eraser changes (canvas may be tainted)', err)
      // ignore taint errors
    }
  }

  const onEraserPointerUp = (e) => {
    if (activeTool !== 'object-eraser') return
    try { if (canvasRef.current && canvasRef.current.releasePointerCapture) canvasRef.current.releasePointerCapture(e.pointerId) } catch (err) {}
    finalizeEraser()
  }

  // mouse move handler for crop overlay
  const onOverlayMouseMove = (e) => {
    if (!isDraggingCrop || !draggingRef.current || !canvasRef.current) return
    e.preventDefault()
    const pos = clientToCanvas(e.clientX, e.clientY)
    const { x, y } = pos
    const { startX, startY, origRect } = draggingRef.current
    let nr = { ...origRect }
    const cw = canvasRef.current.width
    const ch = canvasRef.current.height
    const extra = 160 // allow crop to extend beyond image bounds by this many pixels per side
    const maxW = Math.max(1, cw + extra * 2)
    const maxH = Math.max(1, ch + extra * 2)

    if (dragHandle === 'move') {
      const dx = x - startX
      const dy = y - startY
      nr.x = Math.round(origRect.x + dx)
      nr.y = Math.round(origRect.y + dy)
      // clamp position so crop stays within allowed extension
      if (nr.x < -extra) nr.x = -extra
      if (nr.y < -extra) nr.y = -extra
      if (nr.x + nr.width > cw + extra) nr.x = cw + extra - nr.width
      if (nr.y + nr.height > ch + extra) nr.y = ch + extra - nr.height
    } else {
      if (dragHandle === 't') {
        const newY = Math.min(origRect.y + origRect.height - 1, Math.round(y))
        nr.height = origRect.y + origRect.height - newY
        nr.y = newY
        if (aspectRatio && nr.width > 0 && nr.height > 0) {
          const targetW = Math.round(nr.height * aspectRatio)
          const centerX = Math.round(origRect.x + origRect.width / 2)
          nr.width = Math.max(1, Math.min(maxW, targetW))
          nr.x = Math.round(centerX - nr.width / 2)
        }
      } else if (dragHandle === 'b') {
        const newHeight = Math.round(y) - origRect.y
        nr.height = Math.max(1, newHeight)
        if (aspectRatio && nr.width > 0 && nr.height > 0) {
          const targetW = Math.round(nr.height * aspectRatio)
          const centerX = Math.round(origRect.x + origRect.width / 2)
          nr.width = Math.max(1, Math.min(maxW, targetW))
          nr.x = Math.round(centerX - nr.width / 2)
        }
      } else if (dragHandle === 'l') {
        const newX = Math.round(x)
        nr.width = origRect.x + origRect.width - newX
        nr.x = newX
        if (aspectRatio && nr.width > 0 && nr.height > 0) {
          const targetH = Math.round(nr.width / aspectRatio)
          const centerY = Math.round(origRect.y + origRect.height / 2)
          nr.height = Math.max(1, Math.min(maxH, targetH))
          nr.y = Math.round(centerY - nr.height / 2)
        }
      } else if (dragHandle === 'r') {
        const newWidth = Math.round(x) - origRect.x
        nr.width = Math.max(1, newWidth)
        if (aspectRatio && nr.width > 0 && nr.height > 0) {
          const targetH = Math.round(nr.width / aspectRatio)
          const centerY = Math.round(origRect.y + origRect.height / 2)
          nr.height = Math.max(1, Math.min(maxH, targetH))
          nr.y = Math.round(centerY - nr.height / 2)
        }
      } else if (dragHandle === 'nw') {
        const newX = Math.min(origRect.x + origRect.width - 1, Math.max(-extra, Math.round(x)))
        const newY = Math.min(origRect.y + origRect.height - 1, Math.max(-extra, Math.round(y)))
        nr.width = origRect.x + origRect.width - newX
        nr.height = origRect.y + origRect.height - newY
        nr.x = newX
        nr.y = newY
      } else if (dragHandle === 'ne') {
        const newX = Math.max(origRect.x + 1, Math.round(x))
        const newY = Math.min(origRect.y + origRect.height - 1, Math.max(-extra, Math.round(y)))
        nr.width = newX - origRect.x
        nr.height = origRect.y + origRect.height - newY
        nr.y = newY
      } else if (dragHandle === 'sw') {
        const newX = Math.min(origRect.x + origRect.width - 1, Math.max(-extra, Math.round(x)))
        const newY = Math.max(origRect.y + 1, Math.round(y))
        nr.width = origRect.x + origRect.width - newX
        nr.height = newY - origRect.y
        nr.x = newX
      } else if (dragHandle === 'se') {
        const newX = Math.max(origRect.x + 1, Math.round(x))
        const newY = Math.max(origRect.y + 1, Math.round(y))
        nr.width = newX - origRect.x
        nr.height = newY - origRect.y
      }
      if (aspectRatio && nr.width > 0 && nr.height > 0) {
        const targetH = Math.round(nr.width / aspectRatio)
        nr.height = targetH
      }
      // When resizing (not moving), keep the crop centered on the canvas
      if (dragHandle !== 'move') {
        nr.x = Math.round((cw - nr.width) / 2)
        nr.y = Math.round((ch - nr.height) / 2)
      }
      // clamp sizes and positions to allowed extension bounds
      nr.x = Math.round(nr.x)
      nr.y = Math.round(nr.y)
      nr.width = Math.max(1, Math.min(nr.width, maxW))
      nr.height = Math.max(1, Math.min(nr.height, maxH))
      if (nr.x < -extra) nr.x = -extra
      if (nr.y < -extra) nr.y = -extra
      if (nr.x + nr.width > cw + extra) nr.x = cw + extra - nr.width
      if (nr.y + nr.height > ch + extra) nr.y = ch + extra - nr.height
    }
    setCropRect(nr)
  }

    // Update dimensions and zoom as crop changes
    useEffect(() => {
      if (cropRect) {
        const minDim = 50 // minimum width/height to zoom in
        const w = Math.round(cropRect.width)
        const h = Math.round(cropRect.height)

        // Update dimension inputs
        setCropDimensionWidth(String(w))
        setCropDimensionHeight(String(h))

        // If crop is large enough, zoom to show it at full canvas width
        // Only auto-zoom when the user is NOT currently interacting with the crop
        if (!isDraggingCrop && !userInteractingCropRef.current && w >= minDim && h >= minDim && canvasRef.current && centerRef.current) {
          const canvas = canvasRef.current
          const container = centerRef.current
          const padding = 40
          const availW = Math.max(100, container.clientWidth - padding)
          const availH = Math.max(100, container.clientHeight - padding)

          // Calculate zoom to fit cropped area to viewport
          const scaleX = availW / w
          const scaleY = availH / h
          const scale = Math.min(scaleX, scaleY, 1) // cap at 100%
          const newZoom = Math.floor(scale * 100)
          // Only set zoom if it differs meaningfully to avoid jitter
          if (Math.abs(newZoom - zoom) > 2) setZoom(newZoom)
        }
      }
    }, [cropRect])

  const onOverlayMouseUp = (e) => {
    if (!isDraggingCrop) return
    setIsDraggingCrop(false)
    setDragHandle(null)
    draggingRef.current = null
    // allow auto-zoom again shortly after user finishes interacting
    if (suppressAutoZoomTimeoutRef.current) clearTimeout(suppressAutoZoomTimeoutRef.current)
    suppressAutoZoomTimeoutRef.current = setTimeout(() => {
      userInteractingCropRef.current = false
      suppressAutoZoomTimeoutRef.current = null
    }, 300)
  }

  // APPLY CROP
  const applyCrop = async () => {
    if (!canvasRef.current || !cropRect) return
    const src = canvasRef.current
    const extra = 150
    const tmp = document.createElement('canvas')
    tmp.width = Math.max(1, Math.round(cropRect.width))
    tmp.height = Math.max(1, Math.round(cropRect.height))
    const tctx = tmp.getContext('2d')
    // clear and draw the existing canvas into tmp at an offset so out-of-bounds crop areas produce transparent padding
    tctx.clearRect(0, 0, tmp.width, tmp.height)
    tctx.drawImage(src, Math.round(-cropRect.x), Math.round(-cropRect.y))
    const dataUrl = tmp.toDataURL('image/png')
    await new Promise((res) => {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        setOriginalImage(img)
        setEditedImage(img)
        setCropRect({ x: 0, y: 0, width: img.width, height: img.height })
        // Update dimension inputs with new image size
        setCropDimensionWidth(String(img.width))
        setCropDimensionHeight(String(img.height))
        res()
      }
      img.src = dataUrl
    })
    // After crop, the cropped section now fills the entire canvas
    // Scale it to fit the viewport without scroll
    setTimeout(() => fitToViewport(), 50)
    toast('Crop applied - cropped section now fills canvas')
  }

  //RESER CROP
  const resetCrop = () => {
    if (!canvasRef.current) return
    setCropRect({ x: 0, y: 0, width: canvasRef.current.width, height: canvasRef.current.height })
    setAspectRatio(null)
    setTimeout(() => fitToViewport(), 0)
  }

  const handleCancel = () => {
    setEditState(false)
    setEditInfo(null)
  }

  const toolsList = [
    { id: 'crop', label: 'Crop & Extend', icon: Crop, color: 'text-army' },
    { id: 'adjust', label: 'Adjust', icon: Sliders, color: 'text-army' },
    { id: 'filters', label: 'Filters', icon: Wand2, color: 'text-army' },
    { id: 'object-eraser', label: 'Object Eraser', icon: Scissors, color: 'text-army' },
    { id: 'background', label: 'Background', icon: Scissors, color: 'text-army' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col overflow-hidden text-xs">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-3">
          <Button onClick={handleCancel} variant="ghost" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-800">
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </Button>
          <h1 className="text-xs font-semibold text-gray-900 dark:text-white">Edit Studio</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleReset}
            variant="ghost"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <RotateCcw size={18} />
            <span className="ml-1 text-xs">Revert to Original</span>
          </Button>
          <Button
            onClick={handleUndo}
            variant="ghost"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Undo size={18} />
          </Button>
          <Button
            onClick={handleRedo}
            variant="ghost"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Redo size={18} />
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleCancel} variant="outline" className="px-6 h-7 text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="px-6 bg-core hover:bg-core/90 h-7 text-xs text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN EDITOR */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR - TOOLS */}
        <div className="w-56 bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {/* TOOLS SECTION */}
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Tools</p>
              <div className="flex flex-col gap-2">
                {toolsList.map((tool) => {
                  const IconComponent = tool.icon
                  return (
                    <Button
                      key={tool.id}
                      variant="ghost"
                      onClick={() => setActiveTool(tool.id)}
                      className={`cursor-pointer flex items-center gap-3 px-3 h-7 rounded-lg text-xs font-medium transition-all ${
                        activeTool === tool.id
                          ? 'bg-armylight dark:bg-blue-950 text-army border-l-4 border-l-core'
                          : 'bg-white border-army border dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <IconComponent size={16} className={tool.color} />
                      {tool.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
              {/* ADJUST SECTION */}
              {activeTool === 'adjust' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-900 dark:text-white">
                        Brightness
                      </label>
                      <span className="text-xs text-gray-500">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-army"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-900 dark:text-white">
                        Contrast
                      </label>
                      <span className="text-xs text-gray-500">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-army"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-900 dark:text-white">
                        Saturation
                      </label>
                      <span className="text-xs text-gray-500">{saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-army"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-900 dark:text-white">
                        Rotation
                      </label>
                      <span className="text-xs text-gray-500">{rotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-army"
                    />
                  </div>
                </div>
              )}

              {/* CROP SECTION */}
              {activeTool === 'crop' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white mb-2">
                      Crop Presets
                    </p>
                      <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Free', ratio: null },
                        { label: 'Original', ratio: null },
                        { label: '1:1', ratio: '1:1' },
                        { label: '1:2', ratio: '1:2' },
                        { label: '2:1', ratio: '2:1' },
                        { label: '16:9', ratio: '16:9' },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          onClick={() => {
                            if (!canvasRef.current) return
                            const canvas = canvasRef.current
                            if (!preset.ratio) {
                              setAspectRatio(null)
                              setCropRect({ x: 0, y: 0, width: canvas.width, height: canvas.height })
                            } else {
                              const [pw, ph] = preset.ratio.split(':').map(Number)
                              const ar = pw / ph
                              setAspectRatio(ar)
                              const cw = canvas.width
                              const ch = canvas.height
                              let tw = cw
                              let th = Math.round(tw / ar)
                              if (th > ch) { th = ch; tw = Math.round(th * ar) }
                              const x = Math.round((cw - tw) / 2)
                              const y = Math.round((ch - th) / 2)
                              setCropRect({ x, y, width: tw, height: th })
                            }
                            setTimeout(() => fitToViewport(), 0)
                          }}
                          className="cursor-pointer px-2 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-neutral-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                      Dimensions
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Width"
                        value={cropDimensionWidth}
                        onChange={(e) => setCropDimensionWidth(e.target.value)}
                        onBlur={handleCropDimensionChange}
                        className="px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder="Height"
                        value={cropDimensionHeight}
                        onChange={(e) => setCropDimensionHeight(e.target.value)}
                        onBlur={handleCropDimensionChange}
                        className="px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button onClick={applyCrop} className="flex-1 h-7 text-xs bg-army hover:bg-army/85 text-white">
                        Apply Crop
                      </Button>
                      <Button onClick={resetCrop} variant="outline" className="flex-1 h-7 text-xs">
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* FILTERS SECTION */}
              {activeTool === 'filters' && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-900 dark:text-white mb-3">
                    Filter Presets
                  </p>
                  {[
                    'Grayscale',
                    'Sepia',
                    'Invert',
                    'Blur',
                    'Sharpen',
                    'Warm',
                  ].map((filter) => (
                    <Button
                      key={filter}
                      variant="ghost"
                      className="cursor-pointer w-full h-7 text-left px-3 text-xs rounded hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition"
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
              )}

              {/* OBJECT ERASER SECTION */}
              {activeTool === 'object-eraser' && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">
                    Eraser Options
                  </p>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">
                      Brush Size
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="200"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-army"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">
                      Strength
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={eraserStrength}
                      onChange={(e) => setEraserStrength(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-army"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Click+drag on the canvas to erase (make transparent).</p>
                </div>
              )}

              {/* BACKGROUND SECTION */}
              {activeTool === 'background' && (
                <div className="space-y-4">
                  <p className="text-xs font-medium text-gray-900 dark:text-white mb-2">Backgrounds</p>

                  <div>
                    <Button
                      onClick={() => removeBackground()}
                      className="w-full h-7 px-3 text-xs font-medium rounded bg-core text-white hover:opacity-95 transition flex items-center justify-center"
                    >
                      Remove Background
                    </Button>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-2">Fill</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      {['#ffffff','#000000','#f7fafc','#f0e6d2','#e8cfc1','#c6d9d0','#b0d7ef','#cfcfcf'].map((color) => (
                        <Button
                          key={color}
                          variant="ghost"
                          onClick={() => applyBackgroundFill(color)}
                          title={color}
                          style={{ background: color }}
                          className="w-8 h-8 rounded border border-gray-300 dark:border-neutral-700"
                        />
                      ))}
                      <input
                        type="color"
                        onChange={(e) => applyBackgroundFill(e.target.value)}
                        className="w-8 h-8 p-0 border rounded"
                        aria-label="Custom color"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 mb-2">Images</p>
                      <Button variant="ghost" className="text-xs text-army hover:underline" onClick={() => toast('See more backgrounds')}>
                        See More
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {/* sample thumbnails - replace with real library when available */}
                      {['/dummy-bg-1.jpg','/dummy-bg-2.jpg','/dummy-bg-3.jpg'].map((u, i) => (
                        <Button
                          key={i}
                          variant="ghost"
                          onClick={() => applyBackgroundImage(u)}
                          className="cursor-pointer p-1 bg-white dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-800 overflow-hidden"
                        >
                          <img src={u} alt={`bg-${i}`} className="w-full h-16 object-cover rounded" />
                        </Button>
                      ))}

                      <label className="flex items-center justify-center border border-dashed rounded text-xs text-gray-600 dark:text-gray-300 p-2 cursor-pointer">
                        <span className="text-xs">Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files && e.target.files[0]
                            if (!f) return
                            const url = URL.createObjectURL(f)
                            applyBackgroundImage(url)
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER CANVAS - EDITOR */}
        <div ref={centerRef} className="flex-1 bg-gray-50 dark:bg-neutral-800 flex items-center justify-center overflow-hidden p-6">
          <div
            ref={canvasContainerRef}
            className="relative bg-transparent dark:bg-neutral-800 rounded-lg shadow-lg flex items-center justify-center"
            style={{ width: '95%', height: '95%', overflow: 'hidden' }}
          >
              <canvas
                ref={canvasRef}
                className="object-contain"
                onPointerDown={onEraserPointerDown}
                onPointerMove={onEraserPointerMove}
                onPointerUp={onEraserPointerUp}
                onPointerLeave={onEraserPointerUp}
                style={{
                  maxWidth: `${zoom}%`,
                  maxHeight: `${zoom}%`,
                  width: 'auto',
                  height: 'auto',
                  display: 'block',
                  cursor: activeTool === 'object-eraser' ? 'crosshair' : 'default'
                }}
              />

            {activeTool === 'crop' && originalImage && cropRect && (
              <div
                className="absolute inset-0 z-30"
                onMouseDown={onOverlayMouseDown}
                onMouseMove={onOverlayMouseMove}
                onMouseUp={onOverlayMouseUp}
                onMouseLeave={onOverlayMouseUp}
                style={{ cursor: isDraggingCrop ? (dragHandle === 'move' ? 'grabbing' : 'nwse-resize') : 'crosshair' }}
              >
                {(() => {
                  const d = getDisplayCrop()
                  if (!d) return null
                  const fullW = canvasContainerRef.current ? canvasContainerRef.current.clientWidth : 0
                  const fullH = canvasContainerRef.current ? canvasContainerRef.current.clientHeight : 0
                  return (
                    <>
                      {/* shaded regions */}
                      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: d.top, background: 'rgba(0,0,0,0.45)' }} />
                      <div style={{ position: 'absolute', left: 0, top: d.top, width: d.left, height: d.height, background: 'rgba(0,0,0,0.45)' }} />
                      <div style={{ position: 'absolute', left: d.left + d.width, top: d.top, width: Math.max(0, fullW - (d.left + d.width)), height: d.height, background: 'rgba(0,0,0,0.45)' }} />
                      <div style={{ position: 'absolute', left: 0, top: d.top + d.height, width: '100%', height: Math.max(0, fullH - (d.top + d.height)), background: 'rgba(0,0,0,0.45)' }} />

                      {/* crop rect */}
                      <div style={{ position: 'absolute', left: d.left, top: d.top, width: d.width, height: d.height, border: '2px solid rgba(255,255,255,0.9)', boxShadow: '0 0 0 1px rgba(0,0,0,0.6) inset', background: 'transparent' }} />

                      {/* corner handles */}
                      {['nw','ne','sw','se'].map((h) => {
                        const cx = h === 'nw' || h === 'sw' ? d.left : d.left + d.width
                        const cy = h === 'nw' || h === 'ne' ? d.top : d.top + d.height
                        return (
                          <div key={h} style={{ position: 'absolute', left: cx - 6, top: cy - 6, width: 12, height: 12, background: 'white', border: '1px solid rgba(0,0,0,0.6)', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
                        )
                      })}
                      {/* midpoint handles - top (t), right (r), bottom (b), left (l) */}
                      {(() => {
                        const mid = [
                          { k: 't', x: Math.round(d.left + d.width / 2), y: Math.round(d.top) },
                          { k: 'r', x: Math.round(d.left + d.width), y: Math.round(d.top + d.height / 2) },
                          { k: 'b', x: Math.round(d.left + d.width / 2), y: Math.round(d.top + d.height) },
                          { k: 'l', x: Math.round(d.left), y: Math.round(d.top + d.height / 2) }
                        ]
                        return mid.map((m) => (
                          <div
                            key={m.k}
                            style={{
                              position: 'absolute',
                              left: m.x - 6,
                              top: m.y - 6,
                              width: 12,
                              height: 12,
                              background: 'white',
                              border: '1px solid rgba(0,0,0,0.6)',
                              borderRadius: 2,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                              cursor: m.k === 't' || m.k === 'b' ? 'ns-resize' : 'ew-resize'
                            }}
                          />
                        ))
                      })()}
                    </>
                  )
                })()}
              </div>
            )}

          </div>
        </div>

        {/* RIGHT SIDEBAR - CONTROLS */}
        <div className="w-60 bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 overflow-y-auto p-4 flex flex-col gap-4">
          {/* ZOOM CONTROL */}
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
              Zoom
            </p>
              <div className="flex items-center gap-2">
              <Button onClick={() => setZoom(Math.max(25, zoom - 10))} variant="ghost" className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded">
                <ZoomOut size={16} className="text-army" />
              </Button>
              <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 text-center">
                {zoom}%
              </span>
              <Button onClick={() => setZoom(Math.min(200, zoom + 10))} variant="ghost" className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded">
                <ZoomIn size={16} className="text-army" />
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
            {/* ACTION BUTTONS */}
            <p className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
              Actions
            </p>
              <div className="flex flex-col gap-2">
              <Button onClick={handleDuplicate} className="w-full h-7 px-3 text-xs font-medium rounded bg-neutral-100 dark:bg-neutral-800 text-army hover:bg-neutral-200 dark:hover:bg-neutral-700 transition flex items-center justify-center gap-2">
                <Copy size={14} />
                Duplicate
              </Button>
              <Button onClick={handleDelete} className="w-full h-7 px-3 text-xs font-medium rounded bg-red-50 dark:bg-red-950 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 transition flex items-center justify-center gap-2">
                <Trash2 size={14} />
                Delete
              </Button>
              {/* Remove Background action is available in the left Tools area */}
            </div>
            <div className="flex items-center gap-2 mt-3 p-2 border border-gray-200 dark:border-neutral-700 rounded">
              <Checkbox
                id="replace-image"
                checked={replaceImage}
                onCheckedChange={setReplaceImage}
              />
              <label
                htmlFor="replace-image"
                className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Replace Image
              </label>
            </div>
          </div>

          {/* IMAGE INFO */}
          <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 mt-auto">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              IMAGE INFO
            </p>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <p><strong>Name:</strong> {editInfo?.name || 'Unknown'}</p>
              {originalImage && (
                <>
                  <p><strong>Size:</strong> {originalImage.width} × {originalImage.height}</p>
                </>
              )}
            </div>
          </div>

            {/* IMAGE NAME EDITOR */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-900 dark:text-white flex-1">Rename File</p>
                {!isEditingName ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingName(true)
                      setTempName(imageName)
                    }}
                    className="p-1 h-5 w-5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </Button>
                ) : null}
              </div>
              {isEditingName ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    autoFocus
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImageName(tempName)
                        setIsEditingName(false)
                      }}
                      className="p-1 h-7 w-7 text-green-600"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingName(false)}
                      className="p-1 h-7 w-7 text-gray-600"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-700 dark:text-gray-300 wrap-break-words">{imageName}</p>
              )}
            </div>

            {/* IMAGE SIZE INFO */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Size</p>
              {originalImage && (
                <p className="text-xs text-gray-600 dark:text-gray-400">{originalImage.width} × {originalImage.height} px</p>
              )}
            </div>
        </div>
      </div>
    </div>
  )
}

export default EditImage

