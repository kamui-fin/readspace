"use client"

import { useParams } from "next/navigation"
import SimilarFeedsClient from "./similar-client"

export default function SimilarFeedsPage() {
    const params = useParams()
    const feedId = params.id as string

    return <SimilarFeedsClient feedId={feedId} />
}
