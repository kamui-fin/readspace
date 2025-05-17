import { Pricing } from "./pricing"

export default function PricingSection() {
    return (
        <div className="mt-36 my-24 max-w-6xl w-full mx-auto" id="pricing">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold mb-3 text-[#1A1A1A]">
                    Simple, affordable pricing
                </h1>
                <p className="px-4 text-[#1A1A1A]/70 text-lg max-w-2xl mx-auto">
                    Start free, or go Pro for unlimited AI features—plus 50% off
                    for students.
                </p>
            </div>
            <Pricing />
        </div>
    )
}
