"use client"

interface PricingToggleProps {
    isYearly: boolean
    setIsYearly: (value: boolean) => void
}

export function PricingToggle({ isYearly, setIsYearly }: PricingToggleProps) {
    return (
        <div className="inline-flex items-center rounded-full border border-[#E4ECDF] p-1 bg-white">
            <button
                onClick={() => setIsYearly(false)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    !isYearly
                        ? "bg-[#E4ECDF] text-[#1A1A1A]"
                        : "text-[#1A1A1A]/60"
                }`}
            >
                Monthly
            </button>
            <button
                onClick={() => setIsYearly(true)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center ${
                    isYearly
                        ? "bg-[#E4ECDF] text-[#1A1A1A]"
                        : "text-[#1A1A1A]/60"
                }`}
            >
                Annual{" "}
                <span className="ml-3 text-xs font-bold bg-[#6A994E] text-white px-2 py-0.5 rounded-full">
                    save 33%
                </span>
            </button>
        </div>
    )
}
