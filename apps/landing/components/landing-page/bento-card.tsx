import { cn } from "@/lib/utils"
import Image, { StaticImageData } from "next/image"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../ui/card"

export const BentoCard = ({
    title,
    description,
    image,
    className,
}: {
    title: string
    description: string
    image: StaticImageData
    className?: string
}) => {
    return (
        <Card className={cn("max-w-[550px] md:max-w-none", className)}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="relative">
                <Image
                    src={image}
                    alt=""
                    width="0"
                    height="0"
                    sizes="100vw"
                    className="w-full h-auto"
                />
            </CardContent>
        </Card>
    )
}
