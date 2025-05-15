import React, { useState } from "react"

import "./style/Toolbar.css"

interface ToolbarProps {
    setPdfScaleValue: (value: number) => void
    toggleHighlightPen: () => void
}

const Toolbar = ({ setPdfScaleValue, toggleHighlightPen }: ToolbarProps) => {
    const [zoom, setZoom] = useState<number | null>(null)
    const [isHighlightPen, setIsHighlightPen] = useState<boolean>(true)

    const zoomIn = () => {
        if (zoom) {
            if (zoom < 4) {
                setPdfScaleValue(zoom + 0.1)
                setZoom(zoom + 0.1)
            }
        } else {
            setPdfScaleValue(1)
            setZoom(1)
        }
    }

    const zoomOut = () => {
        if (zoom) {
            if (zoom > 0.2) {
                setPdfScaleValue(zoom - 0.1)
                setZoom(zoom - 0.1)
            }
        } else {
            setPdfScaleValue(1)
            setZoom(1)
        }
    }

    return (
        <div className="Toolbar">
            <div className="ZoomControls">
                <button title="Zoom in" onClick={zoomIn}>
                    +
                </button>
                <button title="Zoom out" onClick={zoomOut}>
                    -
                </button>
                {zoom ? `${(zoom * 100).toFixed(0)}%` : "Auto"}
            </div>
            <button
                title="Highlight"
                className={`HighlightButton ${isHighlightPen ? "active" : ""}`}
                onClick={() => {
                    toggleHighlightPen()
                    setIsHighlightPen(!isHighlightPen)
                }}
            >
                Toggle Highlights
            </button>
        </div>
    )
}

export default Toolbar
