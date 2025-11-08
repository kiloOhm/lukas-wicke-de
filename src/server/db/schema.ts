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
	(table) => ({
		pk: primaryKey({ columns: [table.collection, table.imageId] })
	})
);
