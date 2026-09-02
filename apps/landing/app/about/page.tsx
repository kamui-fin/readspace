import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AboutPage() {
    return (
        <>
            <section className="py-24 md:py-32">
                <div className="mx-auto max-w-3xl px-6 lg:px-0">
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-semibold mb-6">
                                About Us
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                We built a reading app that brings together news outlets, magazines, and websites you already follow, so you don&apos;t have to open ten different apps or tabs to catch up. Add the sources you trust, and read them in one clean, distraction-free feed — organized your way, with nothing pushed on you by an algorithm.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                It&apos;s available now as a web app, with mobile apps and browser extensions coming soon.
                            </p>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                This is an indie project, built by one person who wanted a calmer way to read the news.
                            </p>
                        </div>

                        <div className="pt-8">
                            <Link href="/">
                                <Button variant="outline">Back to home</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
