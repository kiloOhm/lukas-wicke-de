import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const comments = sqliteTable('comments', {
	id: text('id').primaryKey(),
	collection: text('collection').notNull(),
	imageId: text('image_id').notNull(),
	text: text('text').notNull(),
	createdAt: text('created_at')
		.notNull()
		// default just for safety; we'll usually set it in code
		.default(sql`CURRENT_TIMESTAMP`),
	name: text('name')
});

export const imageCommentStats = sqliteTable(
	'image_comment_stats',
	{
		collection: text('collection').notNull(),
		imageId: text('image_id').notNull(),
		commentCount: integer('comment_count').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.collection, table.imageId] })]
);

export const collections = sqliteTable('collections', {
	name: text('name').primaryKey(),
	password: text('password'),
	thumb: text('thumb')
});

export const images = sqliteTable('images', {
	id: text('id').primaryKey(),
	fileName: text('file_name').notNull().default(''),
	alt: text('alt').notNull(),
	width: integer('width'),
	height: integer('height'),
	collection: text('collection')
		.references(() => collections.name)
		.notNull(),
});

export const extraFiles = sqliteTable('extra_files', {
	id: text('id').primaryKey(),
	collection: text('collection')
		.references(() => collections.name)
		.notNull(),
	name: text('name').notNull()
});
