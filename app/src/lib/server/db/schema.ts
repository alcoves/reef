import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey(),
	email: text("email").notNull().unique(),
	avatar: text("avatar"),
	passwordHash: text("password_hash").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
	id: text("id").primaryKey(),
	userId: uuid("user_id"),
	expiresAt: timestamp("expires_at", {
		withTimezone: true,
		mode: "date",
	}).notNull(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
	assets: many(assets),
	sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const assets = pgTable("assets", {
	id: uuid().defaultRandom().primaryKey(),
	ownerId: uuid("owner_id").notNull(),
	type: text({ enum: ["VIDEO", "IMAGE"] })
		.default("VIDEO")
		.notNull(),
	title: text().notNull(),
	description: text(),
	status: text({
		enum: ["UPLOADING", "UPLOADED", "PROCESSING", "READY", "ERROR"],
	}),
	storageKey: text("storage_key").notNull(),
	storageBucket: text("storage_bucket").notNull(),

	// Original asset metadata
	metadata: jsonb(), // Metadata of the original asset. Either ffmpeg or exiftool metadata
	size: integer().notNull().default(0),
	width: integer().notNull().default(0),
	height: integer().notNull().default(0),
	duration: real().notNull().default(0),
	mimeType: text("mime_type").notNull(),

	// Time when asset was physically created
	cTime: timestamp("c_time").notNull().defaultNow(),

	deleted: boolean().notNull().default(false),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assetsRelations = relations(assets, ({ one, many }) => ({
	proxies: many(assetProxies),
	thumbnails: many(assetThumbnails),
	owner: one(users, {
		fields: [assets.ownerId],
		references: [users.id],
	}),
}));

export const assetProxies = pgTable("asset_proxies", {
	id: uuid().defaultRandom().primaryKey(),
	assetId: uuid("asset_id").notNull(),
	isDefault: boolean("is_default").notNull().default(false),
	status: text({ enum: ["PROCESSING", "READY", "ERROR"] }),
	type: text({ enum: ["HLS"] }).notNull(),
	storageKey: text("storage_key").notNull(),
	storageBucket: text("storage_bucket").notNull(),
	size: integer().notNull().default(0),
	progress: integer().notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assetThumbnails = pgTable("asset_thumbnails", {
	id: uuid().defaultRandom().primaryKey(),
	assetId: uuid("asset_id").notNull(),
	status: text({ enum: ["PROCESSING", "READY", "ERROR"] }),
	storageKey: text("storage_key").notNull(),
	storageBucket: text("storage_bucket").notNull(),
	size: integer().notNull().default(0),
	width: integer().notNull().default(0),
	height: integer().notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assetThumbnailRelations = relations(
	assetThumbnails,
	({ one }) => ({
		asset: one(assets, {
			fields: [assetThumbnails.assetId],
			references: [assets.id],
		}),
	}),
);

export const assetProxyRelations = relations(assetProxies, ({ one }) => ({
	asset: one(assets, {
		fields: [assetProxies.assetId],
		references: [assets.id],
	}),
}));

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
