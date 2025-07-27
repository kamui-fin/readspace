import {
  Article,
  SaveArticleRequest,
  Folder,
  Tag,
  Feed,
  FeedDiscoveryRequest,
  DiscoveredFeed,
  BulkFeedSubscribeRequest,
  User,
} from '@/types'

export class ReadspaceAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ReadspaceAPIError'
  }
}

export class ReadspaceAPI {
  private baseUrl: string
  private accessToken?: string

  constructor(baseUrl: string, accessToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.accessToken = accessToken
  }

  setAccessToken(token: string) {
    this.accessToken = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        let errorCode = response.status.toString()

        try {
          const errorData = await response.json()
          if (errorData.detail) {
            errorMessage = errorData.detail
          }
          if (errorData.code) {
            errorCode = errorData.code
          }
        } catch {
          // Ignore JSON parsing errors
        }

        throw new ReadspaceAPIError(errorMessage, response.status, errorCode)
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }

      return response.text() as T
    } catch (error) {
      if (error instanceof ReadspaceAPIError) {
        throw error
      }
      throw new ReadspaceAPIError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Authentication - simplified to use the /user-info endpoint
  async getCurrentUser(): Promise<User> {
    const response = await this.request<{
      user_id: string
      email: string
      metadata?: {
        full_name?: string
        avatar_url?: string
      }
    }>('/api/user-info')

    return {
      id: response.user_id,
      email: response.email,
      full_name: response.metadata?.full_name,
      avatar_url: response.metadata?.avatar_url,
    }
  }

  // Articles
  async saveArticle(article: SaveArticleRequest): Promise<Article> {
    return this.request<Article>('/api/rss/articles/save', {
      method: 'POST',
      body: JSON.stringify(article),
    })
  }

  async getArticles(params?: {
    page?: number
    size?: number
    is_read_later?: boolean
    search_query?: string
  }): Promise<{ items: Article[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.size) searchParams.set('size', params.size.toString())
    if (params?.is_read_later !== undefined) {
      searchParams.set('is_read_later', params.is_read_later.toString())
    }
    if (params?.search_query) {
      searchParams.set('search_query', params.search_query)
    }

    return this.request<{ items: Article[]; total: number }>(
      `/api/rss/articles/?${searchParams.toString()}`
    )
  }

  async updateArticle(
    articleId: string,
    updates: Partial<Pick<Article, 'is_read' | 'is_read_later' | 'is_favorite'>>
  ): Promise<Article> {
    return this.request<Article>(`/api/rss/articles/${articleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  // Folders
  async getFolders(): Promise<Folder[]> {
    return this.request<Folder[]>('/api/rss/folders/')
  }

  async createFolder(name: string): Promise<Folder> {
    return this.request<Folder>('/api/rss/folders/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  // Tags
  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>('/api/rss/tags/')
  }

  async createTag(name: string): Promise<Tag> {
    return this.request<Tag>('/api/rss/tags/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  // RSS Feeds
  async discoverFeeds(request: FeedDiscoveryRequest): Promise<DiscoveredFeed[]> {
    return this.request<DiscoveredFeed[]>('/api/rss/feeds/discover', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async createFeed(data: { url: string; folder_id?: string; tag_ids?: string[] }): Promise<Feed> {
    return this.request<Feed>('/api/rss/feeds/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async subscribeToFeeds(request: BulkFeedSubscribeRequest): Promise<void> {
    await this.request('/api/rss/feeds/bulk-subscribe', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async getFeeds(): Promise<Feed[]> {
    return this.request<Feed[]>('/api/rss/feeds/')
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      await this.request('/api/health')
      return true
    } catch {
      return false
    }
  }
} 