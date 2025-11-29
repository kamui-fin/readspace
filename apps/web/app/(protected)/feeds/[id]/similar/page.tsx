"use client"

import { useParams } from "next/navigation"
import SimilarFeedsView from "@/components/features/feeds/SimilarFeedsView"

export default function SimilarFeedsPage() {
    const params = useParams()
    const feedId = params.id as string

    return <SimilarFeedsView feedId={feedId} />
}
