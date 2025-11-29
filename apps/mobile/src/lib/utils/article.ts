import { groupArticlesByDate } from "@lib/utils/date";
import type { Article } from "@readspace/shared";

export interface ListItem {
	type: "section" | "article" | "divider";
	id: string;
	data?: Article;
	sectionTitle?: string;
}

/**
 * Flatten paginated articles and deduplicate by ID
 */
export function processArticles(
	infiniteData: any,
	isViewingFeedOrFolder: boolean,
	activeTab: number,
	filter: string,
): Article[] {
	if (!infiniteData?.pages) return [];

	const articles = infiniteData.pages.flatMap(
		(page: { items?: Article[] }) => page.items || [],
	);

	// Deduplicate articles by ID
	const uniqueArticles = new Map<string, Article>();
	for (const article of articles) {
		if (!uniqueArticles.has(article.id)) {
			uniqueArticles.set(article.id, article);
		}
	}

	let result = Array.from(uniqueArticles.values());

	// When viewing a feed/folder, apply tab-specific filters client-side
	if (isViewingFeedOrFolder && activeTab !== 2) {
		const now = new Date();
		const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		if (activeTab === 0) {
			// Today: articles published in last 24 hours
			result = result.filter((article) => {
				if (!article.published_at) return false;
				const publishedDate = new Date(article.published_at);
				return publishedDate >= twentyFourHoursAgo && publishedDate <= now;
			});
		} else if (activeTab === 1) {
			// Saved: articles marked as read_later
			result = result.filter((article) => article.is_read_later);
		} else if (activeTab === 3) {
			// Recent: articles that have been read (is_read = true)
			result = result.filter((article) => article.is_read);
		}
	}

	// Filter by read/unread/read_later status based on filter state
	if (filter === "unread") {
		result = result.filter((article) => !article.is_read);
	} else if (filter === "read") {
		result = result.filter((article) => article.is_read);
	} else if (filter === "read_later") {
		result = result.filter((article) => article.is_read_later);
	}

	return result;
}

/**
 * Group articles by date and create flat list with sections and dividers
 */
export function createListItems(articles: Article[]): ListItem[] {
	type ArticleWithDate = Article & { date: Date };
	const articlesWithDates: ArticleWithDate[] = articles.map(
		(article: Article) => ({
			...article,
			date: article.published_at ? new Date(article.published_at) : new Date(),
		}),
	);

	const grouped = groupArticlesByDate(articlesWithDates);
	const items: ListItem[] = [];
	let dividerCounter = 0;

	// Sort section headers chronologically
	const sortedSections = Object.entries(grouped).sort((a, b) => {
		const firstArticleA = a[1][0];
		const firstArticleB = b[1][0];
		return firstArticleB.date.getTime() - firstArticleA.date.getTime();
	});

	// Calculate total number of articles to track the last article
	const totalArticles = articlesWithDates.length;
	let articleIndex = 0;

	for (
		let sectionIndex = 0;
		sectionIndex < sortedSections.length;
		sectionIndex++
	) {
		const [sectionTitle, sectionArticles] = sortedSections[sectionIndex];
		const isLastSection = sectionIndex === sortedSections.length - 1;

		// Add section header
		items.push({
			type: "section",
			id: `section-${sectionTitle}`,
			sectionTitle,
		});

		// Add articles with dividers
		for (let i = 0; i < sectionArticles.length; i++) {
			const article = sectionArticles[i];
			const isLastArticle = articleIndex === totalArticles - 1;
			articleIndex++;

			items.push({
				type: "article",
				id: article.id,
				data: article,
			});

			// Add divider after each article except:
			// 1. The last article in the section
			// 2. The very last article in the entire list
			if (i < sectionArticles.length - 1 && !isLastArticle) {
				items.push({
					type: "divider",
					id: `divider-${dividerCounter++}`,
				});
			}
		}

		// Add divider after section (before next section) only if not the last section
		// and not after the last article in the entire list
		if (!isLastSection && articleIndex < totalArticles) {
			items.push({
				type: "divider",
				id: `divider-${dividerCounter++}`,
			});
		}
	}

	return items;
}
