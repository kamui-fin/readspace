import "@/lib/api-client"

import OpmlImportView from "@/components/features/opml/OpmlImportView"

// Force dynamic rendering since we're using cookies for auth
export const dynamic = "force-dynamic"

export default function ImportOPMLPage() {
    return <OpmlImportView />
}
