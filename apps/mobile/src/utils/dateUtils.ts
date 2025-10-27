/**
 * Format a date into section header text based on how old it is
 * @param date - The date to format
 * @returns Formatted string like "Today", "Yesterday", "2 days ago", or "Monday, August 7"
 */
export function formatSectionDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays >= 2 && diffDays <= 5) {
        return `${diffDays} days ago`;
    } else {
        // Format as "Monday, August 7"
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        };
        return date.toLocaleDateString('en-US', options);
    }
}

/**
 * Format a timestamp to relative time (e.g., "2h ago")
 * @param date - The date to format
 * @returns Formatted string like "2h ago", "5m ago", etc.
 */
export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
        return 'just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays === 1) {
        return 'yesterday';
    } else {
        return `${diffDays}d ago`;
    }
}

/**
 * Group articles by date section
 * @param articles - Array of articles with date property
 * @returns Object mapping section headers to article arrays
 */
export function groupArticlesByDate<T extends { date: Date }>(articles: T[]): Record<string, T[]> {
    const grouped: Record<string, T[]> = {};

    for (const article of articles) {
        const sectionHeader = formatSectionDate(article.date);
        if (!grouped[sectionHeader]) {
            grouped[sectionHeader] = [];
        }
        grouped[sectionHeader].push(article);
    }

    return grouped;
}

