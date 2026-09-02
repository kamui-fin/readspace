export const StepHeader = ({
    num,
    title,
    description,
}: {
    num: number
    title: string
    description: string
}) => {
    return (
        <div className="mt-16 mb-10 flex flex-col items-center align-center w-full">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-[#E4ECDF] text-lg font-mono text-black mb-2">
                {num}
            </div>
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-[#111112] text-center">
                {title}
            </h2>
            <p className="mt-2 text-lg md:text-xl text-[#91998C] text-center">
                {description}
            </p>
        </div>
    )
}
