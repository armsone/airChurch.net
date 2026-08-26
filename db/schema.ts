import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const churches = sqliteTable("churches", {
  id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), pastor: text("pastor").notNull(), region: text("region").notNull(), denomination: text("denomination").notNull(), youtubeChannelId: text("youtube_channel_id").unique(), reviewStatus: text("review_status").notNull().default("pending"), holdReason: text("hold_reason"), holdNote: text("hold_note"), heldAt: text("held_at"), priorityWeight: integer("priority_weight").notNull().default(1), reviewerStatus: text("reviewer_status").notNull().default("unreviewed"), reviewerNote: text("reviewer_note"), reviewedAt: text("reviewed_at"), reviewResolutionToken:text("review_resolution_token"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
export const visitorActivity = sqliteTable("visitor_activity", {
  visitorHash: text("visitor_hash").primaryKey(), path: text("path").notNull(), lastSeen: text("last_seen").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_visitor_activity_last_seen").on(table.lastSeen)]);
export const churchRecommendations = sqliteTable("church_recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }), churchName: text("church_name").notNull(), pastor: text("pastor").notNull(), region: text("region").notNull(), denomination: text("denomination").notNull(), youtubeUrl: text("youtube_url"), reason: text("reason").notNull(), status: text("status").notNull().default("pending"), fingerprint: text("fingerprint").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), reviewedAt: text("reviewed_at"),
}, (table) => [index("idx_church_recommendations_status_created").on(table.status, table.createdAt)]);
export const reviewerAccounts = sqliteTable("reviewer_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), contact: text("contact").notNull(), username: text("username").notNull().unique(), passwordHash: text("password_hash").notNull(), passwordSalt: text("password_salt").notNull(), status: text("status").notNull().default("pending"), fingerprint: text("fingerprint").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), reviewedAt: text("reviewed_at"),
}, (table) => [index("idx_reviewer_accounts_status_created").on(table.status, table.createdAt)]);
export const reviewerChurchReviews = sqliteTable("reviewer_church_reviews", {
  id: integer("id").primaryKey({autoIncrement:true}), reviewerId:integer("reviewer_id").notNull(), churchId:integer("church_id").notNull().references(()=>churches.id), status:text("status").notNull().default("unreviewed"), note:text("note"), reviewedAt:text("reviewed_at").notNull().default(sql`CURRENT_TIMESTAMP`), handledAt:text("handled_at"), adminResolution:text("admin_resolution"), adminNote:text("admin_note"), resolvedBy:text("resolved_by"),
},(table)=>[index("idx_reviewer_church_reviews_church").on(table.churchId,table.reviewedAt)]);
