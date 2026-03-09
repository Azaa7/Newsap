# NEWSAP Firestore Schema (Improved)

## Core Collections

### users/{userId}
- name: string
- email: string
- role: string (`user` | `admin`)
- language: string (`mn` | `en`)
- theme: string (`dark` | `light`)
- interests: number[] (category IDs)
- createdAt: timestamp
- updatedAt: timestamp

### sources/{sourceId}
- name: string
- trustScore: number (0-100)
- sourceType: string (`api` | `rss` | `manual`)
- isActive: boolean

### categories/{categoryId}
- name: string
- locale: map
- isActive: boolean

### articles/{articleId}
- title: string
- content: string
- summary: string
- sourceId: reference
- categoryId: number
- publishedAt: timestamp
- status: string (`draft` | `published`)
- tags: string[]

### article_stats/{articleId}
- viewsCount: number
- likesCount: number
- commentsCount: number
- bookmarksCount: number
- updatedAt: timestamp

### bookmarks/{bookmarkId}
- bookmarkId pattern: `${userId}_${articleId}`
- userId: string
- articleId: string
- createdAt: timestamp

### likes/{likeId}
- likeId pattern: `${userId}_${articleId}`
- userId: string
- articleId: string
- createdAt: timestamp

### reading_history/{historyId}
- historyId: auto id
- userId: string
- articleId: string
- categoryId: number
- readAt: timestamp
- dwellSeconds: number

### recommendations/{userId}/feed/{articleId}
- articleId: string
- score: number
- reason: string
- generatedAt: timestamp

## Notes
- Use edge collections (`bookmarks`, `likes`) for many-to-many relations.
- Keep counters in `article_stats` to avoid hot writes on `articles` documents.
- Precompute recommendations into `recommendations/{userId}/feed` for fast home loading.
- Archive old `reading_history` records (e.g., 90 days) to control cost.
