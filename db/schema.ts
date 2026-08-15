import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const churches = sqliteTable("churches", {
  id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), pastor: text("pastor").notNull(), region: text("region").notNull(), denomination: text("denomination").notNull(), youtubeChannelId: text("youtube_channel_id").unique(), reviewStatus: text("review_status").notNull().default("pending"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_churches_search").on(table.region, table.name, table.pastor)]);
export const sermons = sqliteTable("sermons", {
  id: integer("id").primaryKey({ autoIncrement: true }), churchId: integer("church_id").notNull().references(() => churches.id), youtubeId: text("youtube_id").notNull().unique(), title: text("title").notNull(), thumbnailUrl: text("thumbnail_url").notNull(), publishedAt: text("published_at").notNull(), status: text("status").notNull().default("published"), viewCount: integer("view_count").notNull().default(0), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_sermons_published_at").on(table.publishedAt), index("idx_sermons_status_published").on(table.status, table.publishedAt)]);
export const praiseVideos = sqliteTable("praise_videos", {
  id: integer("id").primaryKey({ autoIncrement: true }), churchId: integer("church_id").notNull().references(() => churches.id), youtubeId: text("youtube_id").notNull().unique(), title: text("title").notNull(), thumbnailUrl: text("thumbnail_url").notNull(), publishedAt: text("published_at").notNull(), status: text("status").notNull().default("published"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_praise_videos_status_published").on(table.status, table.publishedAt)]);
export const talentOffers = sqliteTable("talent_offers", {
  id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(), region: text("region").notNull(), description: text("description").notNull(), status: text("status").notNull().default("pending"), fingerprint: text("fingerprint").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_talent_offers_status_created").on(table.status, table.createdAt)]);
export const communityPosts = sqliteTable("community_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }), category: text("category").notNull(), nickname: text("nickname").notNull(), content: text("content").notNull(), status: text("status").notNull().default("pending"), reportCount: integer("report_count").notNull().default(0), fingerprint: text("fingerprint").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_community_posts_status_created").on(table.status, table.createdAt)]);
export const syncState = sqliteTable("sync_state", { key: text("key").primaryKey(), lastSyncedAt: text("last_synced_at").notNull() });
export const pageViews = sqliteTable("page_views", {
  id: integer("id").primaryKey({ autoIncrement: true }), path: text("path").notNull(), referrerDomain: text("referrer_domain"), visitorHash: text("visitor_hash").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_page_views_created").on(table.createdAt), index("idx_page_views_visitor_created").on(table.visitorHash, table.createdAt), index("idx_page_views_path_created").on(table.path, table.createdAt)]);
