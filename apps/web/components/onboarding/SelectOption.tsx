import React from "react"

interface SelectOptionProps {
    id: string
    label: string
    value: string
    selected: boolean
    onChange: (value: string) => void
}

const SelectOption: React.FC<SelectOptionProps> = ({
    id,
    label,
    value,
    selected,
    onChange,
}) => {
    return (
        <div
            className={`p-4 border rounded-lg mb-3 cursor-pointer transition-all ${
                selected
                    ? "border-primary bg-accent/30 shadow-sm"
                    : "border-gray-200 hover:border-primary/30 hover:bg-accent/10"
            }`}
            onClick={() => onChange(value)}
        >
            <div className="flex items-center">
                <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selected
                            ? "border-primary bg-primary"
                            : "border-gray-300"
                    }`}
                >
                    {selected && (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-white"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </div>
                <label htmlFor={id} className="ml-3 text-base cursor-pointer">
                    {label}
                </label>
            </div>
        </div>
    )
}

export default SelectOption
