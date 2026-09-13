import DOMPurify from 'dompurify'

const FORBIDDEN_TAGS = [
  'script',
  'style',
  'link',
  'meta',
  'base',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
]

/** Sanitize clipped HTML before it crosses the persistence boundary. */
export function sanitizeArticleHtml(html: string): string {
  if (!html) return ''

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeType !== 1) return

    const element = node as Element
    element.removeAttribute('id')
    element.removeAttribute('style')
    element.removeAttribute('class')
    element.removeAttribute('data-rank')

    if (element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer')
    }
  })

  try {
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: FORBIDDEN_TAGS,
      FORBID_ATTR: ['style', 'srcdoc'],
      ADD_ATTR: ['target'],
      ALLOW_DATA_ATTR: false,
    })
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes')
  }
}
