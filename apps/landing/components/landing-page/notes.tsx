import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "../ui/separator"

export default function Notes() {
    return (
        <div className="container mx-auto max-w-[700px] xl:max-w-[1300px] justify-center py-48 px-8">
            <div className="flex flex-col xl:flex-row gap-2 xl:gap-12 items-center justify-center">
                {" "}
                {/* Changed items-start to items-center */}
                {/* Left side - Teaser, Title and Subheader */}
                <div className="w-full sm:w-3/5 md:w-4/5 space-y-4 text-center md:text-left mb-6">
                    {/* Added text-center and md:text-left */}
                    <p className="text-sm font-medium uppercase tracking-wider text-[#91998C]">
                        Reference with ease
                    </p>
                    <h1 className="text-5xl font-bold tracking-tight">
                        Notes in Real Time
                    </h1>{" "}
                    {/* Reduced text size */}
                    <p className="text-base text-[#91998C]">
                        {" "}
                        {/* Reduced text size */}
                        As you read, Readspace generates high-quality notes
                        distilling key ideas - so you can revist the essence of
                        your books without flipping pages.
                    </p>
                </div>
                {/* Right side - Card */}
                <div className="w-full md:w-4/5">
                    {/* Background card */}
                    <Card className="relative bg-muted p-3 flex items-center justify-center rounded-2xl bg-[#F5F9F3]">
                        {/* Main card */}
                        <Card className="relative z-10 rounded-xl bg-[#FCFFFC]">
                            <CardHeader>
                                <CardTitle className="text-md md:text-xl">
                                    Atomic Habits
                                </CardTitle>{" "}
                                {/* Reduced text size */}
                                <Separator className="my-4" />{" "}
                                {/* Separator between title and body */}
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 text-xs md:text-md leading-[20px]">
                                    {" "}
                                    {/* Reduced text size */}
                                    {/* 1% Rule */}
                                    <ul className="list-disc list-inside">
                                        <li className="font-semibold">
                                            1% Rule:
                                        </li>
                                        <ul className="list-disc list-inside pl-6 text-[#91998C]">
                                            {" "}
                                            {/* Second level */}
                                            <li>
                                                Small, consistent improvements
                                                compound over time. Focus on
                                                getting 1% better daily.
                                            </li>
                                        </ul>
                                    </ul>
                                    {/* Examples */}
                                    <ul className="list-disc list-inside">
                                        <li className="font-semibold">
                                            Examples:
                                        </li>
                                        <ul className="list-disc list-inside pl-6 text-[#91998C]">
                                            {" "}
                                            {/* Second level */}
                                            <li>
                                                Read more → Start with 1
                                                page/day.
                                            </li>
                                            <li>
                                                Get fit → Begin with a 5-minute
                                                walk.
                                            </li>
                                            <li>
                                                Be productive → Do 1 small task
                                                first thing in the morning.
                                            </li>
                                        </ul>
                                    </ul>
                                    {/* Framework */}
                                    <ul className="list-disc list-inside">
                                        <li className="font-semibold">
                                            Framework:
                                        </li>
                                        <ul className="list-disc list-inside pl-6 text-[#91998C]">
                                            {" "}
                                            {/* Second level */}
                                            <li>
                                                Make habits obvious, attractive,
                                                easy, satisfying.
                                            </li>
                                            <li>
                                                Build systems, not just goals.
                                            </li>
                                        </ul>
                                    </ul>
                                    {/* Key Quote */}
                                    <ul className="list-disc list-inside">
                                        <li className="font-semibold">
                                            Key Quote:
                                        </li>
                                        <ul className="list-disc list-inside pl-6 text-[#91998C]">
                                            {" "}
                                            {/* Second level */}
                                            <li className="italic">
                                                &quot;You do not rise to the
                                                level of your goals; you fall to
                                                the level of your systems.&quot;
                                            </li>
                                        </ul>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </Card>
                </div>
            </div>
        </div>
    )
}
