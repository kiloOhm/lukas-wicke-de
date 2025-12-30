import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from './db/client';
import { schema } from './db/client';
import type { CollectionInfo, ImageInfo } from '../types';

export async function getCollections(
	db: DbClient
): Promise<CollectionInfo[]> {
	const collections = await db
		.select()
		.from(schema.collections)
		.orderBy(desc(schema.collections.name))
		.leftJoin(
			schema.images,
			eq(schema.images.collection, schema.collections.name)
		);

	const collectionMap: Record<string, CollectionInfo> = {};

	for (const row of collections) {
		if (!collectionMap[row.collections.name]) {
			collectionMap[row.collections.name] = {
				name: row.collections.name,
				password: row.collections.password || undefined,
				thumb: row.collections.thumb || undefined,
				images: []
			};
		}
		if (row.images?.id) {
			collectionMap[row.collections.name].images.push({
				id: row.images.id,
				alt: row.images.alt,
				width: row.images.width || undefined,
				height: row.images.height || undefined
			});
		}
	}

	return Object.values(collectionMap);
}

export async function getCollectionByName(
	db: DbClient,
	name: string
): Promise<CollectionInfo | null> {
	const collections = await db
		.select()
		.from(schema.collections)
		.where(sql`${schema.collections.name} COLLATE NOCASE = ${name}`)
		.leftJoin(
			schema.images,
			eq(schema.images.collection, schema.collections.name)
		);

	if (collections.length === 0) {
		return null;
	}
	
	const collection: CollectionInfo = {
		name: collections[0].collections.name,
		password: collections[0].collections.password || undefined,
		thumb: collections[0].collections.thumb || undefined,
		images: []
	};
	
	for (const row of collections) {
		if (row.images?.id) {
			collection.images.push({
				id: row.images.id,
				alt: row.images.alt,
				width: row.images.width || undefined,
				height: row.images.height || undefined
			});
		}
	}

	return collection;
}

export async function createCollection(
	db: DbClient,
	collection: {
		name: string;
		password?: string;
		thumb?: string;
	}
): Promise<CollectionInfo> {
		const result = await db
			.insert(schema.collections)
			.values({
				name: collection.name,
				password: collection.password,
				thumb: collection.thumb
			}).returning();
		let images: ImageInfo[] = [];
		return {
			...collection,
			images
		}
}

export async function updateCollection(
	db: DbClient,
	name: string,
	collection: {
		name: string;
		password?: string;
		thumb?: string;
	},
loadImages: boolean = true
): Promise<CollectionInfo> {
		await db
			.update(schema.collections)
			.set({
				name: collection.name,
				password: collection.password,
				thumb: collection.thumb
			})
			.where(eq(schema.collections.name, name));
		
		let images: ImageInfo[] = [];
				if (loadImages) {
			images = (await db
				.select()
				.from(schema.images)
				.where(
					eq(schema.images.collection, collection.name)
				)
				.orderBy(desc(schema.images.position))).map(img => ({
				id: img.id,
				alt: img.alt,
				width: img.width || undefined,
				height: img.height || undefined
			}));
		}
		return {
			...collection,
			images
		}
}

export async function addImagesToCollection(
	db: DbClient,
	collectionName: string,
	images: { id: string; alt: string; width?: number; height?: number }[]
): Promise<void> {
	const existingImages = await db
		.select()
		.from(schema.images)
		.where(
			eq(schema.images.collection, collectionName)
		)
		.orderBy(desc(schema.images.position));

	const maxPosition =
		existingImages.length > 0
			? existingImages[0].position
			: 0;

	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		await db
			.insert(schema.images)
			.values({
				id: img.id,
				alt: img.alt,
				width: img.width,
				height: img.height,
				collection: collectionName,
				position: maxPosition + i + 1
			});
	}
}

export async function deleteImageFromCollection(
	db: DbClient,
	collectionName: string,
	imageId: string
): Promise<void> {
	await db
		.delete(schema.images)
		.where(
			and(
				eq(schema.images.id, imageId),
				eq(schema.images.collection, collectionName)
			)
		);
}

export async function deleteCollection(
	db: DbClient,
	collectionName: string
): Promise<void> {
	await db
		.delete(schema.images)
		.where(
			eq(schema.images.collection, collectionName)
		);
		
	await db
		.delete(schema.collections)
		.where(
			eq(schema.collections.name, collectionName)
		);
}

export async function migrateCollections(
	db: DbClient,
	collections: CollectionInfo[]
): Promise<void> {
		for (const col of collections) {
			const existing = await db
				.select()
				.from(schema.collections)
				.where(eq(schema.collections.name, col.name))
				.limit(1);

			if (existing.length === 0) {
				await db
					.insert(schema.collections)
					.values({
						name: col.name,
						password: col.password,
						thumb: col.thumb
					});
			} else {
				await db
					.update(schema.collections)
					.set({
						password: col.password,
						thumb: col.thumb
					})
					.where(eq(schema.collections.name, col.name));
			}

			const existingImages = await db
				.select()
				.from(schema.images)
				.where(
					eq(schema.images.collection, col.name)
				)
				.orderBy(desc(schema.images.position));

			const maxPosition =
				existingImages.length > 0
					? existingImages[0].position
					: 0;

			for (let i = 0; i < col.images.length; i++) {
				const img = col.images[i];
				const imgExisting = await db
					.select()
					.from(schema.images)
					.where(
						and(
							eq(schema.images.id, img.id),
							eq(schema.images.collection, col.name)
						)
					)
					.limit(1);

				if (imgExisting.length === 0) {
					await db
						.insert(schema.images)
						.values({
							id: img.id,
							alt: img.alt,
							width: img.width,
							height: img.height,
							collection: col.name,
							position: maxPosition + i + 1
						});
				} else {
					await db
						.update(schema.images)
						.set({
							alt: img.alt,
							width: img.width,
							height: img.height
						})
						.where(
							and(
								eq(schema.images.id, img.id),
								eq(schema.images.collection, col.name)
							)
						);
				}
			}
		}
}