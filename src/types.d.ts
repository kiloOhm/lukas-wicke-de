export type GalleryItemInfo = {
  id: string,
  src: string,
  alt: string,
  title?: string,
  href?: string
}

export type ImageInfo = {
  id: string,
  alt: string
}

export type CollectionInfo = {
  name: string,
  password?: string,
  images: ImageInfo[]
  thumb?: string;
}