// PDF.js worker configuration for client-side use only
let pdfjsConfigured = false

export const configurePdfJs = async () => {
  if (typeof window === 'undefined') {
    // Don't configure on server-side
    return
  }

  if (pdfjsConfigured) {
    // Already configured
    return
  }

  try {
    const { pdfjs } = await import('react-pdf')

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()

    pdfjsConfigured = true
  } catch (error) {
    console.error('Failed to configure PDF.js:', error)
  }
}

export const getPdfJs = async (): Promise<any> => {
  await configurePdfJs()
  const { pdfjs } = await import('react-pdf')
  return pdfjs
}