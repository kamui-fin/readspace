import type { ReactNode } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "../ui/button"

interface PricingCardProps {
  icon?: ReactNode
  title: string
  description: string
  price: string
  pricePeriod?: string
  billingNote?: string
  originalPrice?: number
  features: string[]
  includesFree?: boolean
}

export function PricingCard({
  icon,
  title,
  description,
  price,
  pricePeriod = "",
  billingNote = "",
  originalPrice,
  features,
  includesFree = false,
}: PricingCardProps) {
  // Paid tier (includesFree) → primary button; otherwise outline
  const buttonVariant = includesFree ? "default" : "outline"
  const buttonText = includesFree ? "Upgrade to Pro" : "Start for Free"

  return (
    <div
      className={`
        rounded-xl border
        ${includesFree
          ? "border-accent bg-gradient-to-br from-secondary/10 to-white shadow-sm hover:shadow-md transition-shadow duration-200"
          : "border-[#E4ECDF]/70 bg-[#FAFCFA]"
        }
        p-8 relative h-full flex flex-col
      `}
    >
      <div className="mb-6">
        {icon && (
          <div className={includesFree ? "text-[#386641]" : "text-[#386641]/70"}>
            {icon}
          </div>
        )}
        <h3 className={`text-xl font-bold mt-4 ${includesFree ? "text-[#1A1A1A]" : "text-[#1A1A1A]/80"}`}>
          {title}
        </h3>
        <p className={`text-sm mt-1 ${includesFree ? "text-[#1A1A1A]/60" : "text-[#1A1A1A]/50"}`}>
          {description}
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline">
          <span className={`text-4xl font-bold ${includesFree ? "text-[#1A1A1A]" : "text-[#1A1A1A]/80"}`}>
            {price}
          </span>
          <span className={`ml-1 ${includesFree ? "text-[#1A1A1A]/60" : "text-[#1A1A1A]/50"}`}>
            {pricePeriod}
          </span>
        </div>
        {billingNote && (
          <p className="text-xs text-[#1A1A1A]/60 mt-1">{billingNote}</p>
        )}
        {originalPrice && (
          <>
            <div className="flex items-center mt-1">
              <span className="text-sm text-[#1A1A1A]/60 line-through mr-2">
                ${originalPrice}
              </span>
              <span className="text-xs font-bold bg-[#6A994E] text-white px-2 py-0.5 rounded-full">
                50% off during beta
              </span>
            </div>
            <p className="text-xs text-[#1A1A1A]/70 mt-2">
              Lock in this price forever when you join during beta
            </p>
          </>
        )}
      </div>

      {includesFree ? (
        <div className="mb-4">
          <p className="font-medium text-[#1A1A1A]">Everything in Free, plus:</p>
        </div>
      ) : (
        <div className="mb-4">
          <p className="font-medium text-[#1A1A1A]/80">What You Get:</p>
        </div>
      )}

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex">
            <Check
              className={`h-5 w-5 mr-3 flex-shrink-0 ${
                includesFree ? "text-[#6A994E]" : "text-[#6A994E]/70"
              }`}
            />
            <span className={`text-sm ${includesFree ? "text-[#1A1A1A]/80" : "text-[#1A1A1A]/70"}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4">
        <Link href="https://beta.readspace.ai">
          <Button
            variant={buttonVariant}
            className={`
              w-full
              ${buttonVariant === "default"
                ? "bg-[#386641] hover:bg-[#386641]/90 text-white"
                : "border-[#386641]/70 text-[#386641]/80 hover:bg-[#E4ECDF]/30"
              }
            `}
          >
            {buttonText}
          </Button>
        </Link>
      </div>
    </div>
  )
}
