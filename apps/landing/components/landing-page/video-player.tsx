"use client"

import React, { Suspense } from "react"

interface VideoPlayerProps {
    src: string
    className?: string
    autoPlay?: boolean
    muted?: boolean
    loop?: boolean
    controls?: boolean
}

const VideoPlayerFallback = () => {
    return (
        <div className="w-full h-full flex items-center justify-center bg-muted animate-pulse">
            <span className="text-muted-foreground">Loading video...</span>
        </div>
    )
}

const VideoContent = ({ src, className, autoPlay = true, muted = true, loop = true, controls = false }: VideoPlayerProps) => {
    return (
        <video
            className={className}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            controls={controls}
            playsInline
        >
            <source src={src} type="video/mp4" />
            Your browser does not support the video tag.
        </video>
    )
}

export default function VideoPlayer(props: VideoPlayerProps) {
    return (
        <Suspense fallback={<VideoPlayerFallback />}>
            <VideoContent {...props} />
        </Suspense>
    )
}