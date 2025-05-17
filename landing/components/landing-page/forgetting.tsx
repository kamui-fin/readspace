import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ClockIcon } from "@/components/ui/clock"
import { RefreshIcon } from "@/components/ui/refresh"
import { TrendingUpDownIcon } from "@/components/ui/trending-up-down"

export default function Forgetting() {
    return (
        <div
            className="container mx-auto px-4 py-12 max-w-[1300px]"
            id={"forgetting"}
        >
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">
                    The Hidden Cost of Forgetting
                </h1>
                <p className="text-lg text-muted-foreground text-[#91998C]">
                    This isn&apos;t just about books -- it&apos;s about lost
                    potential
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 w-full">
                {" "}
                {/* Reduced gap and horizontal padding */}
                <Card className="flex flex-col h-[300px] transition-all bg-[#F5F9F3]">
                    {" "}
                    {/* Reduced height */}
                    <CardContent className="flex-1 flex items-center justify-center p-4">
                        {" "}
                        {/* Reduced padding */}
                        <div className="relative">
                            {/* Outer Circle */}
                            <div className="absolute inset-0 rounded-full bg-[#FCFFFC] -m-1"></div>{" "}
                            {/* Reduced margin */}
                            {/* Inner Circle with Drop Shadow */}
                            <div className="relative rounded-full bg-[#FCFFFC] p-4 shadow-lg">
                                {" "}
                                {/* Reduced padding */}
                                <ClockIcon
                                    size={32}
                                    style={{ color: "#386641" }}
                                    className="focus:outline-none focus:ring-0 hover:outline-none"
                                />{" "}
                                {/* Reduced icon size */}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="text-left p-6 flex flex-col justify-start items-start gap-1">
                        {" "}
                        {/* Reduced padding and gap */}
                        <p className="text-2xl font-bold">Wasted Time</p>{" "}
                        {/* Reduced font size */}
                        <p className="text-sm text-muted-foreground text-[#91998C]">
                            {" "}
                            {/* Reduced font size */}
                            The 40 hours you spent reading Atomic Habits? Gone,
                            like it never happened.
                        </p>
                    </CardFooter>
                </Card>
                <Card className="flex flex-col h-[300px] transition-all bg-[#F5F9F3]">
                    <CardContent className="flex-1 flex items-center justify-center p-4">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-[#FCFFFC] -m-1"></div>
                            <div className="relative rounded-full bg-[#FCFFFC] p-4 shadow-lg">
                                <TrendingUpDownIcon
                                    size={32}
                                    style={{ color: "#386641" }}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="text-left p-6 flex flex-col justify-start items-start gap-1">
                        <p className="text-2xl font-bold">
                            Missed Opportunities
                        </p>
                        <p className="text-sm text-muted-foreground text-[#91998C]">
                            That brilliant idea from last month’s book? It
                            could’ve been your promotion.
                        </p>
                    </CardFooter>
                </Card>
                {/* Card 3 */}
                <Card className="flex flex-col h-[300px] transition-all bg-[#F5F9F3]">
                    <CardContent className="flex-1 flex items-center justify-center p-4">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-[#FCFFFC] -m-1"></div>
                            <div className="relative rounded-full bg-[#FCFFFC] p-4 shadow-lg">
                                <RefreshIcon
                                    size={32}
                                    style={{ color: "#386641" }}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="text-left p-6 flex flex-col justify-start items-start gap-1">
                        <p className="text-2xl font-bold">
                            Cycle of Self-Doubt
                        </p>
                        <p className="text-sm text-muted-foreground text-[#91998C]">
                            Slowly you start wondering if reading just
                            doesn&apos;t work. Slowly, you stop growing.
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
