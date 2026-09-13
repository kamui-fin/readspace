import { useState } from 'react'

interface ArticleHeroImageProps {
  src?: string
}

/**
 * Article lead image. Reserves its height while loading and removes itself if the
 * image is missing or fails (e.g. hotlink protection). Key it by `src` so a new
 * page resets the load state.
 */
export function ArticleHeroImage({ src }: ArticleHeroImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  if (!src || hasFailed) return null

  return (
    <div className="h-36 w-full overflow-hidden rounded-md bg-foreground/5">
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasFailed(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
