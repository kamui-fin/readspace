interface DiscoverLayoutProps {
    children: React.ReactNode
    centerVertically?: boolean
}

/**
 * Layout wrapper for the discover page
 */
export function DiscoverLayout({ children, centerVertically = false }: DiscoverLayoutProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <main className={`flex-1 px-4 py-4 md:px-6 md:py-6 ${centerVertically ? 'flex items-center justify-center' : ''}`}>
                {children}
            </main>
        </div>
    )
}
