const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'cardscanner_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface User {
  id: string;
  email?: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  is_public?: boolean;
}

export interface UserProfile extends User {
  follower_count: number;
  following_count: number;
  card_count: number;
  is_following: boolean;
}

export interface Card {
  id: string;
  player_name: string;
  team?: string;
  position?: string;
  year?: number;
  set_name?: string;
  variant?: string;
  card_number?: string;
  sport: string;
}

export interface CollectionItem {
  id: string;
  user_id: string;
  card_id: string;
  image_url?: string;
  condition?: string;
  notes?: string;
  purchase_price?: number;
  for_sale?: boolean;
  asking_price?: number;
  created_at: string;
  player_name?: string;
  team?: string;
  year?: number;
  set_name?: string;
  variant?: string;
  low_price?: number;
  mid_price?: number;
  high_price?: number;
}

export interface Post {
  id: string;
  user_id: string;
  collection_item_id: string;
  caption?: string;
  created_at: string;
  author_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  image_url?: string;
  player_name?: string;
  team?: string;
  year?: number;
  set_name?: string;
  variant?: string;
  mid_price?: number;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export interface Valuation {
  id: string;
  card_id: string;
  low_price?: number;
  mid_price?: number;
  high_price?: number;
  sale_count?: number;
  fetched_at?: string;
}

export interface ScanResult {
  item: CollectionItem;
  player_name: string;
  team?: string;
  position?: string;
  year?: number;
  set_name?: string;
  variant?: string;
  card_number?: string;
  condition_estimate?: string;
  confidence: number;
  notes?: string;
}

export interface CollectionStats {
  total_cards: number;
  portfolio_value: number;
  total_cost: number;
  unique_players: number;
  years_represented: number;
}

export class API {
  static token: string | null = null;

  static init() {
    if (typeof window !== 'undefined') {
      API.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  static setToken(token: string | null) {
    API.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }

  static async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (API.token) {
      headers['Authorization'] = `Bearer ${API.token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body.message ?? body.error ?? message;
      } catch {
        // ignore parse errors
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }

  // Auth
  static async login(email: string, password: string) {
    const data = await API.request<{ token: string; user: User }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    API.setToken(data.token);
    return data;
  }

  static async signup(email: string, username: string, password: string) {
    const data = await API.request<{ token: string; user: User }>(
      '/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      }
    );
    API.setToken(data.token);
    return data;
  }

  static async getMe() {
    return API.request<{ user: User }>('/auth/me');
  }

  // Cards
  static async scanCard(imageBlob: Blob): Promise<ScanResult> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'card.jpg');

    const headers: Record<string, string> = {};
    if (API.token) {
      headers['Authorization'] = `Bearer ${API.token}`;
    }

    const res = await fetch(`${BASE_URL}/cards/scan`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body.message ?? body.error ?? message;
      } catch {
        // ignore
      }
      throw new ApiError(res.status, message);
    }

    return res.json();
  }

  static async searchCards(q: string) {
    return API.request<{ cards: Card[] }>(
      `/cards/search?q=${encodeURIComponent(q)}`
    );
  }

  // Collection
  static async getCollection(params: {
    page?: number;
    sort?: string;
    player?: string;
    year?: number;
    set_name?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.sort) qs.set('sort', params.sort);
    if (params.player) qs.set('player', params.player);
    if (params.year) qs.set('year', String(params.year));
    if (params.set_name) qs.set('set_name', params.set_name);
    return API.request<{ items: CollectionItem[]; total: number; page: number; pages: number }>(
      `/collection?${qs.toString()}`
    );
  }

  static async getCollectionStats() {
    return API.request<{ stats: CollectionStats }>('/collection/stats/summary');
  }

  static async getUserCollection(userId: string) {
    return API.request<{ owner: UserProfile; items: CollectionItem[] }>(
      `/collection/${userId}`
    );
  }

  static async getCollectionItem(id: string) {
    return API.request<{ item: CollectionItem }>(`/collection/items/${id}`);
  }

  static async updateCollectionItem(
    id: string,
    data: Partial<CollectionItem>
  ) {
    return API.request<{ item: CollectionItem }>(`/collection/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static async deleteCollectionItem(id: string) {
    return API.request<void>(`/collection/items/${id}`, {
      method: 'DELETE',
    });
  }

  // Social
  static async getFeed(page?: number) {
    const qs = page ? `?page=${page}` : '';
    return API.request<{ posts: Post[]; page: number; has_more: boolean }>(
      `/social/feed${qs}`
    );
  }

  static async createPost(collection_item_id: string, caption?: string) {
    return API.request<{ post: Post }>('/social/posts', {
      method: 'POST',
      body: JSON.stringify({ collection_item_id, caption }),
    });
  }

  static async deletePost(id: string) {
    return API.request<void>(`/social/posts/${id}`, { method: 'DELETE' });
  }

  static async likePost(id: string) {
    return API.request<void>(`/social/posts/${id}/like`, { method: 'POST' });
  }

  static async unlikePost(id: string) {
    return API.request<void>(`/social/posts/${id}/like`, { method: 'DELETE' });
  }

  static async getComments(postId: string) {
    return API.request<{ comments: Comment[] }>(
      `/social/posts/${postId}/comments`
    );
  }

  static async createComment(postId: string, content: string) {
    return API.request<{ comment: Comment }>(
      `/social/posts/${postId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );
  }

  static async deleteComment(id: string) {
    return API.request<void>(`/comments/${id}`, { method: 'DELETE' });
  }

  static async followUser(userId: string) {
    return API.request<void>(`/social/follow/${userId}`, { method: 'POST' });
  }

  static async unfollowUser(userId: string) {
    return API.request<void>(`/social/follow/${userId}`, {
      method: 'DELETE',
    });
  }

  static async searchUsers(q: string) {
    return API.request<{ users: User[] }>(
      `/social/users/search?q=${encodeURIComponent(q)}`
    );
  }

  static async getUserProfile(userId: string) {
    return API.request<{ profile: UserProfile }>(`/social/users/${userId}`);
  }

  // Valuation
  static async getValuation(cardId: string) {
    return API.request<{ valuation: Valuation | null; card: Card }>(
      `/valuation/${cardId}`
    );
  }
}

// Initialize token on module load
API.init();
