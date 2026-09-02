"use client"

export default function AboutSection() {
    return (
        <section id="about" className="py-24 md:py-32">
            <div className="mx-auto max-w-3xl px-6 lg:px-0">
                <h2 className="text-3xl md:text-4xl font-semibold mb-8">About</h2>
                <div className="space-y-6">
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        There was a point when reading online meant seeking something out — checking in on a site because you cared what it had to say, not because an algorithm decided it was time. Readspace is built to bring that back. Add the news outlets, magazines, and blogs you actually follow, and read them in one clean feed with nothing sorted, boosted, or hidden by anyone but you.
                    </p>

                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Nothing here is optimized to keep you scrolling. No ranking system decides what you see first, no engagement metrics are quietly steering the feed, and there&apos;s no ad model that benefits from more of your time. The goal is the opposite: get in, catch up on what matters to you, and get back to your day.
                    </p>

                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Available now as a web app, with mobile apps and browser extensions on the way.
                    </p>

                    <p className="text-lg text-muted-foreground leading-relaxed">
                        An indie project, built by one person who missed the quieter internet.
                    </p>
                </div>
            </div>
        </section>
    )
}
