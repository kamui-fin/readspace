/**
 * Mock AI summary generator for development
 * Returns a realistic-looking article summary after a brief delay
 */
export async function generateMockSummary(articleTitle: string): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Return a mock summary
    return `This article explores the key concepts and developments surrounding "${articleTitle}". The main points include an analysis of current trends, practical implications for readers, and expert perspectives on the subject matter. The author provides compelling evidence and real-world examples to support their arguments, making a strong case for why this topic deserves attention.`;
}
