import { PDFViewer } from "pdfjs-dist/types/web/pdf_viewer"
import type { LTWH } from "react-pdf-highlighter-extended"
import { isHTMLCanvasElement } from "./pdfjs-dom"

const getAreaAsPng = (canvas: HTMLCanvasElement, position: LTWH): string => {
    const { left, top, width, height } = position

    const doc = canvas ? canvas.ownerDocument : null
    // @TODO: cache this?
    const newCanvas = doc && doc.createElement("canvas")

    if (!newCanvas || !isHTMLCanvasElement(newCanvas)) {
        return ""
    }

    newCanvas.width = width
    newCanvas.height = height

    const newCanvasContext = newCanvas.getContext("2d")

    if (!newCanvasContext || !canvas) {
        return ""
    }

    const dpr: number = window.devicePixelRatio

    newCanvasContext.drawImage(
        canvas,
        left * dpr,
        top * dpr,
        width * dpr,
        height * dpr,
        0,
        0,
        width,
        height
    )

    return newCanvas.toDataURL("image/png")
}

const screenshot = (position: LTWH, pageNumber: number, viewer: PDFViewer) => {
    return getAreaAsPng(viewer.getPageView(pageNumber - 1).canvas, position)
}

export default screenshot
