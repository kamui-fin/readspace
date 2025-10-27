export interface MockArticleData {
  id: string;
  title: string;
  source: string;
  sourceFavicon: string;
  author: string;
  date: string;
  readTime: string;
  imageUrl: string;
  htmlContent: string;
  url: string;
}

export function getMockArticle(id: string): MockArticleData {
  return {
    id,
    title: "OpenAI's Atlas Wants to Be the Web's Tour Guide. I'm Not Convinced It Needs One",
    source: "WIRED",
    sourceFavicon: "https://www.wired.com/favicon.ico",
    author: "Lauren Goode",
    date: "Oct 24, 2025",
    readTime: "8 min read",
    imageUrl:
      "https://media.wired.com/photos/68fc1ab3582abcd215b5b4b2/master/w_2240,c_limit/gear_openai_atlas_browser%20_tour.jpg",
    url: "https://www.wired.com/story/openai-atlas-browser",
    htmlContent: `
      <article>
        <p>OpenAI has launched Atlas, a new AI-powered browser assistant that promises to revolutionize how we navigate the web. But after spending a week with it, I'm not entirely sure we need another layer between us and the internet.</p>

        <h2>What Atlas Does</h2>
        <p>Atlas is essentially a browser extension that sits in your toolbar, constantly analyzing the pages you visit and offering contextual suggestions. It can summarize articles, extract key facts, compare products, and even help you navigate complex websites.</p>

        <p>The technology is impressive. Using GPT-4's latest iteration, Atlas can understand nuanced content and provide genuinely helpful insights. When I was reading a dense research paper, it offered a concise summary that captured the main arguments perfectly.</p>

        <h2>The Problem with Intermediaries</h2>
        <p>But here's where my skepticism kicks in: Do we really want another intermediary between us and the web? The internet is already cluttered with recommendation algorithms, curated feeds, and AI assistants trying to "help" us consume content more efficiently.</p>

        <p>There's something valuable about the serendipity of organic web browsing—clicking through links, discovering unexpected connections, and forming our own interpretations without an AI guide constantly whispering suggestions in our ear.</p>

        <h2>Privacy Concerns</h2>
        <p>OpenAI has stated that Atlas processes most data locally and only sends anonymized usage statistics back to their servers. However, the extension still needs to read every page you visit to provide its features. That's a significant amount of data access, even if it's processed locally.</p>

        <p>The company has been transparent about their data practices, but the fact remains: you're giving an AI assistant permission to see everything you browse. For some users, the convenience might be worth the trade-off. For others, it's a privacy nightmare.</p>

        <h2>Who Actually Benefits?</h2>
        <p>I spent considerable time thinking about who Atlas is actually for. Power users who already know how to navigate the web efficiently probably don't need it. Less tech-savvy users might find it helpful, but they're also the demographic most vulnerable to over-relying on AI assistants without critically evaluating their suggestions.</p>

        <p>Perhaps the real beneficiaries are people with accessibility needs. Atlas can help navigate websites with poor design, extract information from cluttered pages, and provide audio summaries for visually impaired users. These are genuinely valuable use cases that justify the tool's existence.</p>

        <h2>The Verdict</h2>
        <p>Atlas is technically impressive and occasionally useful. But it's also another example of Silicon Valley's obsession with "solving" problems that might not need solving. The web doesn't necessarily need a tour guide—it needs better designed websites, more transparent algorithms, and users who are empowered to navigate it themselves.</p>

        <p>That said, if you're someone who struggles with information overload or needs accessibility assistance, Atlas might be worth trying. Just be mindful of the trade-offs you're making when you invite an AI to mediate your entire browsing experience.</p>
      </article>
    `,
  };
}

