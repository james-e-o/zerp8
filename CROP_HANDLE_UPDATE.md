# Crop Handle Updates Needed

## 1. In onOverlayMouseDown function (around line 324):
After the corner detection loop, add midpoint handle detection:

```javascript
    // Check midpoint handles (t, b, l, r for top, bottom, left, right)
    const midpoints = {
      t: { px: cropRect.x + cropRect.width / 2, py: cropRect.y },
      b: { px: cropRect.x + cropRect.width / 2, py: cropRect.y + cropRect.height },
      l: { px: cropRect.x, py: cropRect.y + cropRect.height / 2 },
      r: { px: cropRect.x + cropRect.width, py: cropRect.y + cropRect.height / 2 }
    }
    for (const k of Object.keys(midpoints)) {
      if (within(midpoints[k].px, midpoints[k].py)) {
        setDragHandle(k)
        setIsDraggingCrop(true)
        draggingRef.current = { startX: x, startY: y, origRect: { ...cropRect } }
        return
      }
    }
```

## 2. In onOverlayMouseMove function (around line 378):
After the 'se' handler, add handlers for midpoints:

```javascript
      } else if (dragHandle === 't') {
        // top-middle: move top edge
        const newY = Math.min(origRect.y + origRect.height - 1, Math.max(0, Math.round(y)))
        nr.height = origRect.y + origRect.height - newY
        nr.y = newY
      } else if (dragHandle === 'b') {
        // bottom-middle: move bottom edge
        const newY = Math.max(origRect.y + 1, Math.round(y))
        nr.height = newY - origRect.y
      } else if (dragHandle === 'l') {
        // left-middle: move left edge
        const newX = Math.min(origRect.x + origRect.width - 1, Math.max(0, Math.round(x)))
        nr.width = origRect.x + origRect.width - newX
        nr.x = newX
      } else if (dragHandle === 'r') {
        // right-middle: move right edge
        const newX = Math.max(origRect.x + 1, Math.round(x))
        nr.width = newX - origRect.x
      }
```

## 3. In crop overlay rendering (around line 877):
After the corner handles rendering, add midpoint handles:

```javascript
                      {/* corner handles */}
                      {['nw','ne','sw','se'].map((h) => {
                        const cx = h === 'nw' || h === 'sw' ? d.left : d.left + d.width
                        const cy = h === 'nw' || h === 'ne' ? d.top : d.top + d.height
                        return (
                          <div key={h} style={{ position: 'absolute', left: cx - 6, top: cy - 6, width: 12, height: 12, background: 'white', border: '1px solid rgba(0,0,0,0.6)', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
                        )
                      })}

                      {/* midpoint handles */}
                      {(() => {
                        const midpoints = [
                          { key: 't', cx: d.left + d.width / 2, cy: d.top },
                          { key: 'b', cx: d.left + d.width / 2, cy: d.top + d.height },
                          { key: 'l', cx: d.left, cy: d.top + d.height / 2 },
                          { key: 'r', cx: d.left + d.width, cy: d.top + d.height / 2 }
                        ]
                        return midpoints.map((m) => (
                          <div key={m.key} style={{ position: 'absolute', left: m.cx - 5, top: m.cy - 5, width: 10, height: 10, background: '#4A90E2', border: '1px solid rgba(255,255,255,0.8)', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
                        ))
                      })()}
                    </>
                  )
                })()}
              </div>
            )}
```
