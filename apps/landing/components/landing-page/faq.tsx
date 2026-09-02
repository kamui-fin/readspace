import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

export default function FAQ() {
    const heading = "FAQ"
    const items = [
        {
            question: "Aren’t notes enough?",
            answer: "No, notes alone aren’t enough. Writing them down is passive—you capture information but don’t deeply engage with it. Real learning happens when you struggle to recall and connect ideas, not just store them. Without actively applying or reflecting on your notes, they remain scattered facts, not true understanding.",
        },
        {
            question: "If AI does all the work for me, how would I learn?",
            answer: "The AI acts as a coach, not a crutch—by prompting questions and highlighting gaps, it turns passive reading into active learning driven by your own effort.",
        },
        {
            question:
                "Is it worth spending so much time on active recall while reading?",
            answer: "The time you invest in active recall is an investment in <b>depth</b> over <b>superficiality</b>. It is the difference between skimming the surface of knowledge and diving into its depths. The hours you save later are not just time; they are the preservation of your intellectual integrity.",
        },
        {
            question: "How will this help me with school / college?",
            answer: "Readspace helps you study smarter, not harder, by breaking down complex ideas and making them stick with techniques like active recall—so you spend less time cramming and more time actually understanding.",
        },
        {
            question: "How do I get my student discount?",
            answer: "Just signup with your school email and the discount will be applied automatically.",
        },
        {
            question: "I have a feature idea or bug that I'd like to report.",
            answer: "We’d love to hear it! <a href='/contact' class='text-primary hover:underline'>Contact us</a> so that voted-up features go on our roadmap, and bugs get fixed fast.",
        },
    ]

    return (
        <section className="py-16 md:py-24 lg:py-32" id="faq">
            <div className="container px-4 md:px-6 mx-auto max-w-4xl">
                <h1 className="mb-6 text-2xl sm:text-3xl font-semibold md:mb-8 lg:mb-11 md:text-4xl lg:text-5xl text-center">
                    {heading}
                </h1>
                <div className="space-y-4 md:space-y-4">
                    {items.map((item, index) => (
                        <Accordion key={index} type="single" collapsible>
                            <AccordionItem
                                value={`item-${index}`}
                                className="border rounded-lg px-2"
                            >
                                <AccordionTrigger className="hover:text-foreground/90 hover:no-underline text-sm sm:text-base md:text-lg py-4 px-2 text-left">
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-sm sm:text-base px-2 pb-4">
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: item.answer,
                                        }}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                </div>
            </div>
        </section>
    )
}
