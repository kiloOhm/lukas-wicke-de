import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from './db/client';
import { schema } from './db/client';

export type CommentDTO = {
	id: string;
	collection: string;
	imageId: string;
	text: string;
	createdAt: string;
	name?: string | null;
};

export async function getComments(
	db: DbClient,
	collection: string,
	imageId: string
): Promise<CommentDTO[]> {
	const rows = await db
		.select({
			id: schema.comments.id,
			collection: schema.comments.collection,
			imageId: schema.comments.imageId,
			text: schema.comments.text,
			createdAt: schema.comments.createdAt,
			name: schema.comments.name
		})
		.from(schema.comments)
		.where(and(eq(schema.comments.collection, collection), eq(schema.comments.imageId, imageId)))
		.orderBy(desc(schema.comments.createdAt));

	return rows;
}

export async function addComment(
	db: DbClient,
	collection: string,
	imageId: string,
	text: string,
	name?: string
): Promise<CommentDTO> {
	const id = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const safeName = (name ?? 'Guest').slice(0, 80);

	// Insert comment + atomically bump the counter
	await db.batch([
		db.insert(schema.comments).values({
			id,
			collection,
			imageId,
			text,
			createdAt,
			name: safeName
		}),
		db
			.insert(schema.imageCommentStats)
			.values({
				collection,
				imageId,
				commentCount: 1
			})
			.onConflictDoUpdate({
				target: [schema.imageCommentStats.collection, schema.imageCommentStats.imageId],
				set: {
					// comment_count = comment_count + 1
					commentCount: sql`${schema.imageCommentStats.commentCount} + 1`
				}
			})
	]);

	return { id, collection, imageId, text, createdAt, name: safeName };
}

export async function getCommentCountsForCollection(
	db: DbClient,
	collection: string
): Promise<Record<string, number>> {
	const rows = await db
		.select({
			imageId: schema.imageCommentStats.imageId,
			count: schema.imageCommentStats.commentCount
		})
		.from(schema.imageCommentStats)
		.where(eq(schema.imageCommentStats.collection, collection));

	const map: Record<string, number> = {};
	for (const r of rows) map[r.imageId] = r.count ?? 0;
	return map;
}
