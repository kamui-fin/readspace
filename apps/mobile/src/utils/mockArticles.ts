import { formatRelativeTime } from './dateUtils';

export interface MockArticle {
    id: string;
    source: string;
    timestamp: string;
    title: string;
    description?: string;
    imageUrl?: string;
    faviconUrl?: string;
    isRead: boolean;
    isSaved: boolean;
    date: Date;
}

const sources = [
    { name: 'TechCrunch', favicon: 'https://techcrunch.com/favicon.ico' },
    { name: 'The Verge', favicon: 'https://www.theverge.com/favicon.ico' },
    { name: 'Hacker News', favicon: 'https://news.ycombinator.com/favicon.ico' },
    { name: 'Ars Technica', favicon: 'https://arstechnica.com/favicon.ico' },
    { name: 'Wired', favicon: 'https://www.wired.com/favicon.ico' },
    { name: 'MIT Technology Review', favicon: 'https://www.technologyreview.com/favicon.ico' },
];

const titles = [
    'The Future of AI: What We Can Expect in 2025',
    'New JavaScript Framework Claims to Be 10x Faster',
    'Understanding React Server Components',
    'Why Privacy Matters More Than Ever',
    'The Rise of Edge Computing',
    'Building Scalable Mobile Apps with React Native',
    'Machine Learning for Beginners: A Comprehensive Guide',
    'The Evolution of Web Development',
    'How to Build a Better Design System',
    'The State of TypeScript in 2025',
    'Exploring the Latest CSS Features',
    'Performance Optimization Techniques for Modern Web Apps',
    'The Future of Remote Work',
    'Understanding Database Indexing',
    'Building Real-time Applications with WebSockets',
    'The Impact of 5G on Mobile Development',
    'Serverless Architecture: Pros and Cons',
    'Modern Authentication Patterns',
    'The Art of API Design',
    'GraphQL vs REST: Which One to Choose?',
];

const descriptions = [
    'A deep dive into the latest trends and predictions for artificial intelligence',
    'Benchmarks show impressive results, but is it production-ready?',
    'Learn how to leverage the power of server components in your React applications',
    'An analysis of privacy concerns in the digital age',
    'How edge computing is transforming the way we build applications',
    'Best practices and patterns for mobile app development',
    'Everything you need to know to get started with machine learning',
    'From jQuery to modern frameworks: a historical perspective',
    'Tips and tricks for creating maintainable component libraries',
    'New features and improvements in the latest TypeScript release',
    'Container queries, cascade layers, and more',
    'Proven strategies to make your apps faster and more efficient',
    'How companies are adapting to the new normal',
    'Understanding indexes and how they improve query performance',
    'Creating interactive experiences with real-time data',
    'The implications of faster networks for app developers',
    'When to use serverless and when to stick with traditional architectures',
    'Implementing secure authentication in modern applications',
    'Principles for designing intuitive and maintainable APIs',
    'A comprehensive comparison to help you make the right choice',
];

const images = [
    'https://picsum.photos/seed/1/400/300',
    'https://picsum.photos/seed/2/400/300',
    'https://picsum.photos/seed/3/400/300',
    'https://picsum.photos/seed/4/400/300',
    'https://picsum.photos/seed/5/400/300',
    'https://picsum.photos/seed/6/400/300',
    'https://picsum.photos/seed/7/400/300',
    'https://picsum.photos/seed/8/400/300',
    'https://picsum.photos/seed/9/400/300',
    'https://picsum.photos/seed/10/400/300',
];

function getDateDaysAgo(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    return date;
}

export function generateMockArticles(): MockArticle[] {
    const articles: MockArticle[] = [];
    let idCounter = 1;

    // Distribution: Today (4), Yesterday (5), 2 days ago (3), 3 days ago (3), 4 days ago (2), 5 days ago (2), 7 days ago (2)
    const distribution = [
        { daysAgo: 0, count: 4 },
        { daysAgo: 1, count: 5 },
        { daysAgo: 2, count: 3 },
        { daysAgo: 3, count: 3 },
        { daysAgo: 4, count: 2 },
        { daysAgo: 5, count: 2 },
        { daysAgo: 7, count: 2 },
    ];

    for (const { daysAgo, count } of distribution) {
        for (let i = 0; i < count; i++) {
            const source = sources[Math.floor(Math.random() * sources.length)];
            const titleIndex = (idCounter - 1) % titles.length;
            const date = getDateDaysAgo(daysAgo);

            articles.push({
                id: `article-${idCounter}`,
                source: source.name,
                timestamp: formatRelativeTime(date),
                title: titles[titleIndex],
                description: Math.random() > 0.3 ? descriptions[titleIndex] : undefined,
                imageUrl: Math.random() > 0.4 ? images[idCounter % images.length] : undefined,
                faviconUrl: source.favicon,
                isRead: Math.random() > 0.7,
                isSaved: Math.random() > 0.85,
                date,
            });

            idCounter++;
        }
    }

    // Sort by date descending (newest first)
    return articles.sort((a, b) => b.date.getTime() - a.date.getTime());
}

