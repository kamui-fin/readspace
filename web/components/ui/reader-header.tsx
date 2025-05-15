import { cn } from "@/lib/utils"
import React from "react"
import Header from "../navigation/header"
import { ReaderNavActions } from "../reader/reader-nav-actions"

const ReaderHeader = () => {
    const [scrollDirection, setScrollDirection] = React.useState("")

    React.useEffect(() => {
        let lastScrollY = window.scrollY

        const updateScrollDirection = () => {
            const scrollY = window.scrollY
            const direction = scrollY > lastScrollY ? "down" : "up"

            if (direction !== scrollDirection) {
                setScrollDirection(direction)
            }
            lastScrollY = scrollY > 0 ? scrollY : 0
        }
        window.addEventListener("scroll", updateScrollDirection) // add event listener
        return () => {
            window.removeEventListener("scroll", updateScrollDirection) // clean up
        }
    }, [scrollDirection])

    return (
        <div
            className={cn(
                "sticky z-1000 h-24 transition-all duration-200 bg-background/80 backdrop-blur-sm border-b shadow-sm",
                scrollDirection === "down" ? "-top-24" : "top-0"
            )}
        >
            <Header
                breadcrumbItems={[
                    { href: "/library", label: "Home" },
                    // { href: `/library/#`, label: title },
                ]}
            >
                <ReaderNavActions />
            </Header>
        </div>
    )
}

export default ReaderHeader
