'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { CalendarIcon, CheckCircle2, Clock, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

// Types
interface Article {
    id: string;
    title: string;
    description: string;
    source: string;
    time: string;
    date: string;
    dateGroup: string;
    hasImage?: boolean;
    content: ArticleContent;
}

interface ArticleContent {
    title: string;
    author: string;
    time: string;
    date: string;
    views: number;
    paragraphs: string[];
    prerequisites?: string[];
}

// Mock data
const MOCK_ARTICLES: Article[] = [
    {
        id: "1",
        title: "Last Week in AI #309 - OpenAI keeps non-profit & launches Codex, AlphaEvolve, and more!",
        description: "Top News: OpenAI says non-profit will remain in control after backlash",
        source: "FreeCodeCamp Programming Tutorials",
        time: "1 day ago",
        date: "Yesterday",
        dateGroup: "yesterday",
        hasImage: true,
        content: {
            title: "Last Week in AI #309 - OpenAI keeps non-profit & launches Codex, AlphaEvolve, and more!",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "1 day ago",
            date: "Yesterday",
            views: 8,
            paragraphs: [
                "OpenAI announced today that the non-profit entity will maintain governance control, responding to concerns about its corporate structure. This comes after weeks of public debate following leadership changes.",
                "The company also revealed Codex, a new AI-powered coding assistant, and AlphaEvolve, a system for algorithmic optimization. These tools are set to be released to developers in the coming months.",
                "These developments signal OpenAI's continued commitment to balancing commercial interests with its original mission of ensuring artificial general intelligence benefits humanity broadly."
            ]
        }
    },
    {
        id: "2",
        title: "Canvas App Components: A Crash Course for Power Apps Developers",
        description: "If you have experience in traditional software development, low-code tools may feel a bit sparse at first.",
        source: "FreeCodeCamp Programming Tutorials",
        time: "2 days ago",
        date: "Friday, May 16",
        dateGroup: "friday",
        hasImage: true,
        content: {
            title: "Canvas App Components: A Crash Course for Power Apps Developers",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "2 days ago",
            date: "Friday, May 16",
            views: 12,
            paragraphs: [
                "If you have experience in traditional software development, low-code tools may feel a bit sparse at first. However, Power Apps' Canvas Components provide a powerful way to create reusable UI elements.",
                "Canvas Components allow you to encapsulate functionality and UI in a reusable package, similar to components in React or Angular. This approach significantly reduces duplication and makes your apps more maintainable.",
                "In this guide, we'll explore how to create, configure, and use Canvas Components effectively in your Power Apps projects."
            ]
        }
    },
    {
        id: "3",
        title: "How to Write Math Equations in Google Docs",
        description: "Math equations are a critical part of academic papers, research reports, and technical documentation.",
        source: "FreeCodeCamp Programming Tutorials",
        time: "2 days ago",
        date: "Friday, May 16",
        dateGroup: "friday",
        hasImage: true,
        content: {
            title: "How to Write Math Equations in Google Docs",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "2 days ago",
            date: "Friday, May 16",
            views: 15,
            paragraphs: [
                "Math equations are a critical part of academic papers, research reports, and technical documentation. Google Docs offers several ways to insert and edit mathematical expressions.",
                "The most powerful method is using LaTeX notation within the built-in equation editor. This gives you access to the full range of mathematical symbols and formatting options.",
                "In this tutorial, you'll learn how to access the equation editor, use LaTeX commands, and create complex formulas that render beautifully in your documents."
            ]
        }
    },
    {
        id: "4",
        title: "How to make Developer Friends When You Don't Live in Silicon Valley, with Iraqi Engineer Code:Life [Podcast #172]",
        description: "On this week's episode of the podcast, freeCodeCamp founder Quincy Larson interviews software engineer and live coding streamer...",
        source: "FreeCodeCamp Programming Tutorials",
        time: "3 days ago",
        date: "Friday, May 16",
        dateGroup: "friday",
        content: {
            title: "How to make Developer Friends When You Don't Live in Silicon Valley, with Iraqi Engineer Code:Life [Podcast #172]",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "3 days ago",
            date: "Friday, May 16",
            views: 7,
            paragraphs: [
                "On this week's episode of the podcast, freeCodeCamp founder Quincy Larson interviews software engineer and live coding streamer Code:Life about building a developer network outside of traditional tech hubs.",
                "Code:Life shares his experience growing up in Iraq and how he connected with the global developer community through live streaming, open-source contributions, and virtual meetups.",
                "They discuss practical strategies for finding mentorship, collaborators, and job opportunities regardless of your geographic location."
            ]
        }
    },
    {
        id: "5",
        title: "Learn A1 Level Spanish",
        description: "Learning a new language can open doors to new cultures, connections, and opportunities, and Spanish is one of the most widely spoken languages in the world.",
        source: "FreeCodeCamp Programming Tutorials",
        time: "3 days ago",
        date: "Thursday, May 15",
        dateGroup: "thursday",
        content: {
            title: "Learn A1 Level Spanish",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "3 days ago",
            date: "Thursday, May 15",
            views: 8,
            paragraphs: [
                "Learning a new language can open doors to new cultures, connections, and opportunities, and Spanish is one of the most widely spoken languages in the world. Whether you're dreaming of traveling to Spanish-speaking countries, connecting with Spanish-speaking communities, or simply expanding your linguistic skills, taking the first step can be the hardest part. But with the right guidance and a structured, engaging approach, mastering the basics becomes an enjoyable and rewarding experience.",
                "We just published a course on the freeCodeCamp.org YouTube channel that will teach you all about beginner-level Spanish using the highly regarded textbook Aula Internacional 1. This comprehensive, step-by-step course is designed specifically for complete beginners and aligns with the A1 level of the Common European Framework of Reference for Languages (CEFR).",
                "Taught entirely in Spanish to immerse you from the start, this course provides a solid foundation in essential vocabulary, grammar, and conversational skills, making it ideal for anyone starting their language-learning journey. Virginia teaches this A1 level course. She is a certified Spanish teacher with 16 years experience teaching Spanish."
            ]
        }
    },
    {
        id: "6",
        title: "How DNS Works: A Guide to Understanding the Internet's Address Book",
        description: "The Domain Name System (DNS) translates domain names (like example.com) into IP addresses.",
        source: "FreeCodeCamp Programming Tutorials",
        time: "4 days ago",
        date: "Wednesday, May 14",
        dateGroup: "wednesday",
        hasImage: true,
        content: {
            title: "How DNS Works: A Guide to Understanding the Internet's Address Book",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "4 days ago",
            date: "Wednesday, May 14",
            views: 10,
            paragraphs: [
                "The Domain Name System (DNS) translates domain names (like example.com) into IP addresses that computers can understand. This critical internet infrastructure works behind the scenes every time you browse the web.",
                "Understanding DNS is essential for anyone working with networks, web development, or cybersecurity. In this comprehensive guide, we'll walk through the entire DNS resolution process.",
                "You'll learn about DNS servers, records, caching, and common configuration issues. By the end, you'll have a solid grasp of how this fundamental system keeps the internet running smoothly."
            ]
        }
    },
    {
        id: "7",
        title: "Load Balancing with Azure Application Gateway and Azure Load Balancer – When to Use Each One",
        description: "You've probably heard someone mention load balancing when talking about cloud apps.",
        source: "FreeCodeCamp Programming Tutorials",
        time: "5 days ago",
        date: "Wednesday, May 14",
        dateGroup: "wednesday",
        hasImage: true,
        content: {
            title: "Load Balancing with Azure Application Gateway and Azure Load Balancer – When to Use Each One",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "5 days ago",
            date: "Wednesday, May 14",
            views: 6,
            paragraphs: [
                "You've probably heard someone mention load balancing when talking about cloud apps. It's a critical component for building scalable and reliable web services.",
                "Azure offers two main load balancing solutions: Azure Load Balancer and Application Gateway. While they serve similar purposes, they're designed for different scenarios and operate at different layers of the network stack.",
                "This guide will help you understand the key differences between these services and how to choose the right one for your specific needs."
            ]
        }
    },
    {
        id: "8",
        title: "How to Build Slim and Fast Docker Images with Multi-Stage Builds",
        description: "Apps don't stay simple forever. As they grow, so does their complexity.",
        source: "FreeCodeCamp Programming Tutorials",
        time: "4 days ago",
        date: "Wednesday, May 14",
        dateGroup: "wednesday",
        hasImage: true,
        content: {
            title: "How to Build Slim and Fast Docker Images with Multi-Stage Builds",
            author: "FreeCodeCamp Programming Tutorials: Python, JavaScript, Git & More",
            time: "4 days ago",
            date: "Wednesday, May 14",
            views: 18,
            paragraphs: [
                "Apps don't stay simple forever. More features mean more dependencies, slower builds, and heavier Docker images. That's where things start to hurt.",
                "Docker helps, but without the right setup, your builds can quickly get bloated.",
                "Multi-stage builds make things smoother by keeping your images fast, clean, and production-ready. In this guide, you'll learn how to use them to supercharge your Docker workflow.",
                "Let's get into it."
            ],
            prerequisites: [
                "Docker installed and running",
                "Basic understanding of Docker",
                "Some Python knowledge (or any language, really)",
                "Familiarity with the terminal"
            ]
        }
    }
];

export default function ArticlesPage({ sidebarTitle = "All Personal Feeds" }: { sidebarTitle?: string }) {
    const [selectedArticleId, setSelectedArticleId] = useState<string>("8");

    // Group articles by date
    const groupedArticles = useMemo(() => {
        const groups: Record<string, { label: string, articles: Article[] }> = {};

        MOCK_ARTICLES.forEach(article => {
            if (!groups[article.dateGroup]) {
                groups[article.dateGroup] = {
                    label: article.date,
                    articles: []
                };
            }
            groups[article.dateGroup].articles.push(article);
        });

        return groups;
    }, []);

    const selectedArticle = useMemo(() => {
        return MOCK_ARTICLES.find(article => article.id === selectedArticleId);
    }, [selectedArticleId]);

    return (
        <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl rounded-bl-none shadow-sm">
            <ResizablePanelGroup direction="horizontal">
                {/* Sidebar */}
                <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                    <div className="flex h-full flex-col border-r">
                        <div className="flex h-14 items-center justify-between border-b px-4">
                            <h2 className="font-semibold">{sidebarTitle}</h2>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Article list */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex flex-col">
                                {/* Render articles grouped by date */}
                                {Object.entries(groupedArticles).map(([groupId, group]) => (
                                    <div key={groupId}>
                                        {/* Date header */}
                                        <div className="px-3 py-2.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 mt-3 first:mt-1.5">
                                            <div className="flex items-center gap-2">
                                                {group.label === "Yesterday" ? (
                                                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                                            </div>
                                        </div>

                                        {/* Articles in this group */}
                                        {group.articles.map((article, index) => (
                                            <ArticleItem
                                                key={article.id}
                                                title={article.title}
                                                description={article.description}
                                                source={article.source}
                                                time={article.time}
                                                hasImage={article.hasImage}
                                                isActive={article.id === selectedArticleId}
                                                isLastInGroup={index === group.articles.length - 1}
                                                onClick={() => setSelectedArticleId(article.id)}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* Main Content */}
                <ResizablePanel defaultSize={75}>
                    <div className="flex h-full flex-col overflow-hidden">
                        {selectedArticle && (
                            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                                <ArticleContentView article={selectedArticle} />
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}

// Article Content Component
function ArticleContentView({ article }: { article: Article }) {
    return (
        <article className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-semibold mb-3">{article.content.title}</h1>

            <div className="flex items-center gap-2 mb-6">
                <Avatar className="h-6 w-6">
                    <AvatarImage src="/placeholders/avatar.png" />
                    <AvatarFallback>FC</AvatarFallback>
                </Avatar>
                <span className="text-[10px] truncate max-w-[280px]">{article.content.author}</span>
                <span className="text-[10px] text-muted-foreground">• {article.content.time}</span>
                <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 h-4">{article.content.views}</Badge>
            </div>

            <div className="space-y-6">
                {article.content.paragraphs.map((paragraph, index) => (
                    <p key={index} className="text-base text-balance leading-relaxed">
                        {paragraph}
                    </p>
                ))}

                {article.content.prerequisites && (
                    <>
                        <h2 className="text-2xl font-semibold mt-8 mb-4">Prerequisites</h2>
                        <p className="text-base text-balance leading-relaxed">
                            To follow this guide, you should have:
                        </p>
                        <ul className="list-disc pl-6 space-y-4 mt-4">
                            {article.content.prerequisites.map((prerequisite, index) => (
                                <li key={index} className="text-base">{prerequisite}</li>
                            ))}
                        </ul>
                    </>
                )}

                <div className="aspect-video w-full overflow-hidden rounded-lg bg-primary/5 mt-8">
                    {/* Placeholder for code sample or image */}
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        Content Preview Placeholder
                    </div>
                </div>
            </div>
        </article>
    );
}

function ArticleItem({
    title,
    description,
    source,
    time,
    hasImage = false,
    isActive = false,
    isLastInGroup = false,
    onClick
}: {
    title: string;
    description: string;
    source: string;
    time: string;
    hasImage?: boolean;
    isActive?: boolean;
    isLastInGroup?: boolean;
    onClick: () => void;
}) {
    return (
        <div
            className={`mx-0 py-2.5 px-3 ${!isLastInGroup ? 'border-b' : ''} 
            ${!isActive ? 'hover:bg-muted/80 hover:border-l-accent' : ''}
            active:bg-secondary/5
            transition-all duration-200 ease-out cursor-pointer 
            ${isActive ? "bg-secondary/5 border-l-2 border-l-secondary" : "border-l-2 border-l-transparent"}`}
            onClick={onClick}
        >
            <div className="flex gap-3">
                <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{source}</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {time}
                        </span>
                    </div>
                    <h3 className="text-sm font-medium leading-tight">{title}</h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{description}</p>
                </div>
                {hasImage && (
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-secondary/5 transition-colors">
                        <div className="h-full w-full flex items-center justify-center">
                            <div className="h-10 w-10 rounded-sm bg-secondary/10"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
} 