import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DbClient } from './db/client';
import { schema } from './db/client';
import type { CollectionInfo, ImageInfo } from '../types';

export async function getCollections(db: DbClient): Promise<CollectionInfo[]> {
	// 1) Base collections
	const cols = await db
		.select({
			name: schema.collections.name,
			password: schema.collections.password,
			thumb: schema.collections.thumb
		})
		.from(schema.collections)
		.orderBy(desc(schema.collections.name));

	if (cols.length === 0) {
		return [];
	}

	const names = cols.map((c) => c.name);

	// 2) All images for these collections
	const imgs = await db
		.select({
			id: schema.images.id,
			fileName: schema.images.fileName,
			alt: schema.images.alt,
			width: schema.images.width,
			height: schema.images.height,
			collection: schema.images.collection,
		})
		.from(schema.images)
		.where(inArray(schema.images.collection, names))
		.orderBy(desc(schema.images.fileName));

	// 3) All extra files for these collections
	const extras = await db
		.select({
			id: schema.extraFiles.id,
			name: schema.extraFiles.name,
			collection: schema.extraFiles.collection
		})
		.from(schema.extraFiles)
		.where(inArray(schema.extraFiles.collection, names))
		.orderBy(desc(schema.extraFiles.name));

	const imagesByCollection: Record<string, CollectionInfo['images']> = {};
	for (const img of imgs) {
		if (!imagesByCollection[img.collection]) {
			imagesByCollection[img.collection] = [];
		}
		imagesByCollection[img.collection].push({
			id: img.id,
			fileName: img.fileName,
			alt: img.alt,
			width: img.width || undefined,
			height: img.height || undefined
		});
	}

	const extrasByCollection: Record<string, NonNullable<CollectionInfo['extraFiles']>> = {};
	for (const ex of extras) {
		if (!extrasByCollection[ex.collection]) {
			extrasByCollection[ex.collection] = [];
		}
		extrasByCollection[ex.collection].push({
			id: ex.id,
			name: ex.name
		});
	}

	return cols.map((c) => {
		const info: CollectionInfo = {
			name: c.name,
			password: c.password || undefined,
			thumb: c.thumb || undefined,
			images: imagesByCollection[c.name] ?? []
		};

		const ef = extrasByCollection[c.name];
		if (ef && ef.length > 0) {
			info.extraFiles = ef;
		}

		return info;
	});
}

export async function getCollectionByName(
	db: DbClient,
	name: string
): Promise<CollectionInfo | null> {
	// 1) Load collection row first
	const cols = await db
		.select({
			name: schema.collections.name,
			password: schema.collections.password,
			thumb: schema.collections.thumb
		})
		.from(schema.collections)
		.where(sql`${schema.collections.name} COLLATE NOCASE = ${name}`);

	if (cols.length === 0) {
		return null;
	}

	const actualName = cols[0].name;

	// 2) Images (ordered)
	const imgs = await db
		.select({
			id: schema.images.id,
			fileName: schema.images.fileName,
			alt: schema.images.alt,
			width: schema.images.width,
			height: schema.images.height
		})
		.from(schema.images)
		.where(eq(schema.images.collection, actualName))
		.orderBy(desc(schema.images.fileName));

	// 3) Extra files
	const extras = await db
		.select({
			id: schema.extraFiles.id,
			name: schema.extraFiles.name
		})
		.from(schema.extraFiles)
		.where(eq(schema.extraFiles.collection, actualName))
		.orderBy(desc(schema.extraFiles.name));

	const collection: CollectionInfo = {
		name: actualName,
		password: cols[0].password || undefined,
		thumb: cols[0].thumb || undefined,
		images: imgs.map((img) => ({
			id: img.id,
			fileName: img.fileName,
			alt: img.alt,
			width: img.width || undefined,
			height: img.height || undefined
		}))
	};

	if (extras.length > 0) {
		collection.extraFiles = extras.map((ex) => ({ id: ex.id, name: ex.name }));
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
	await db
		.insert(schema.collections)
		.values({
			name: collection.name,
			password: collection.password,
			thumb: collection.thumb
		})
		.returning();
	const images: ImageInfo[] = [];
	return {
		...collection,
		images
	};
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
		images = (
			await db
				.select()
				.from(schema.images)
				.where(eq(schema.images.collection, collection.name))
				.orderBy(desc(schema.images.fileName))
		).map((img) => ({
			id: img.id,
			fileName: img.fileName,
			alt: img.alt,
			width: img.width || undefined,
			height: img.height || undefined
		}));
	}
	return {
		...collection,
		images
	};
}

export async function addImagesToCollection(
	db: DbClient,
	collectionName: string,
	images: { id: string; fileName: string; alt: string; width?: number; height?: number }[]
): Promise<void> {
	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		await db.insert(schema.images).values({
			id: img.id,
			fileName: img.fileName,
			alt: img.alt,
			width: img.width,
			height: img.height,
			collection: collectionName,
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
		.where(and(eq(schema.images.id, imageId), eq(schema.images.collection, collectionName)));
}

export async function deleteCollection(
	db: DbClient,
	collectionName: string,
	bucket: R2Bucket
): Promise<void> {
	// 1) Find extra file object keys so we can delete objects in R2
	const extras = await db
		.select({ id: schema.extraFiles.id })
		.from(schema.extraFiles)
		.where(eq(schema.extraFiles.collection, collectionName));

	// 2) Delete R2 objects (best-effort: don’t leave DB half-deleted if R2 delete throws)
	if (extras.length > 0) {
		const keys = extras.map((e) => e.id);
		await bucket.delete(keys);
	}

	await db.delete(schema.images).where(eq(schema.images.collection, collectionName));
	await db.delete(schema.extraFiles).where(eq(schema.extraFiles.collection, collectionName));
	await db.delete(schema.collections).where(eq(schema.collections.name, collectionName));
}

export async function uploadExtraFile(
	db: DbClient,
	bucket: R2Bucket,
	collectionName: string,
	file: File
): Promise<string> {
	const objectKey = `${collectionName}/extra/${file.name}-${crypto.randomUUID()}`;
	await bucket.put(objectKey, file);

	await db.insert(schema.extraFiles).values({
		id: objectKey,
		collection: collectionName,
		name: file.name
	});
	return objectKey;
}

export async function deleteExtraFile(
	db: DbClient,
	bucket: R2Bucket,
	collectionName: string,
	fileId: string
): Promise<void> {
	await bucket.delete(fileId);

	await db
		.delete(schema.extraFiles)
		.where(and(eq(schema.extraFiles.id, fileId), eq(schema.extraFiles.collection, collectionName)));
}
