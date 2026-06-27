import { ApiClient } from '../core';
import {
  Article,
  ArticleCountsResponse,
  ArticleSummary,
  CheckArticleSavedResponse,
  ExtractFullTextResponse,
  SaveArticleResponse,
  SummarizeRequest,
  SummarizeResponse,
  TranslateRequest,
  TranslateResponse,
} from '../types/articles';

export const articles = {
  getArticles: (params: {
    cursor?: string;
    limit?: number;
    feed_id?: string;
    folder_id?: string;
    is_read?: boolean;
    is_saved?: boolean;
  }): Promise<{
    items: ArticleSummary[];
    next_cursor: string | null;
    has_more: boolean;
    total_count: number | null;
  }> => {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append('cursor', params.cursor);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.feed_id) queryParams.append('feed_id', params.feed_id);
    if (params.folder_id) queryParams.append('folder_id', params.folder_id);
    if (params.is_read !== undefined) queryParams.append('is_read', params.is_read.toString());
    if (params.is_saved !== undefined) queryParams.append('is_saved', params.is_saved.toString());

    const queryString = queryParams.toString();
    return ApiClient.get<{
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }>(`/api/articles/${queryString ? `?${queryString}` : ''}`);
  },

  getRecentlyReadArticles: (params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    items: ArticleSummary[];
    next_cursor: string | null;
    has_more: boolean;
    total_count: number | null;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    return ApiClient.get<{
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }>(`/api/articles/views/recently-read${queryString ? `?${queryString}` : ''}`);
  },

  getReadLaterArticles: (params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    items: ArticleSummary[];
    next_cursor: string | null;
    has_more: boolean;
    total_count: number | null;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    return ApiClient.get<{
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }>(`/api/articles/views/read-later${queryString ? `?${queryString}` : ''}`);
  },

  getUnreadCounts: () => ApiClient.get<ArticleCountsResponse>('/api/articles/counts'),

  getArticle: (id: string, article_type?: string) => {
    const queryParams = new URLSearchParams();
    if (article_type === 'clipped') queryParams.append('clipped', 'true');
    const queryString = queryParams.toString();
    return ApiClient.get<Article>(`/api/articles/${id}${queryString ? `?${queryString}` : ''}`);
  },

  updateArticle: (
    id: string,
    data: {
      is_read?: boolean;
      is_saved?: boolean;
      priority?: string;
      user_note?: string | null;
      title?: string;
    },
    article_type?: string
  ) => {
    const queryParams = new URLSearchParams();
    if (article_type) queryParams.append('article_type', article_type);
    const queryString = queryParams.toString();
    return ApiClient.put<void>(`/api/articles/${id}${queryString ? `?${queryString}` : ''}`, data);
  },

  getTodaysArticles: (params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    items: ArticleSummary[];
    next_cursor: string | null;
    has_more: boolean;
    total_count: number | null;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    return ApiClient.get<{
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }>(`/api/articles/views/today${queryString ? `?${queryString}` : ''}`);
  },

  saveArticle: (data: {
    url: string;
    title?: string;
    content?: string;
    metadata?: Record<string, string>;
  }) => ApiClient.post<SaveArticleResponse>('/api/articles/', data),

  checkArticleSaved: (url: string) => {
    const queryParams = new URLSearchParams();
    queryParams.append('url', url);
    return ApiClient.get<CheckArticleSavedResponse>(
      `/api/articles/check-saved?${queryParams.toString()}`
    );
  },

  extractFullText: (id: string, article_type?: string) => {
    const queryParams = new URLSearchParams();
    if (article_type === 'clipped') queryParams.append('clipped', 'true');
    const queryString = queryParams.toString();
    return ApiClient.post<ExtractFullTextResponse>(
      `/api/articles/${id}/extract-full-text${queryString ? `?${queryString}` : ''}`
    );
  },

  summarize: (id: string, data: SummarizeRequest, article_type?: string) => {
    const queryParams = new URLSearchParams();
    if (article_type === 'clipped') queryParams.append('clipped', 'true');
    const queryString = queryParams.toString();
    return ApiClient.post<SummarizeResponse>(
      `/api/articles/${id}/summarize${queryString ? `?${queryString}` : ''}`,
      data
    );
  },

  translate: (id: string, data: TranslateRequest, article_type?: string) => {
    const queryParams = new URLSearchParams();
    if (article_type === 'clipped') queryParams.append('clipped', 'true');
    const queryString = queryParams.toString();
    return ApiClient.post<TranslateResponse>(
      `/api/articles/${id}/translate${queryString ? `?${queryString}` : ''}`,
      data
    );
  },
};
