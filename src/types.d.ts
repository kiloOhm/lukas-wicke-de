export type GalleryItemInfo = {
  id: string,
  src: string,
  alt: string,
  title?: string,
  href?: string
  width?: number,
  height?: number
}

export type ImageInfo = {
  id: string,
  alt: string,
  width?: number,
  height?: number
}

export type CollectionInfo = {
  name: string,
  password?: string,
  images: ImageInfo[]
  thumb?: string;
}

export type GalleryImage = GalleryItemInfo & {
  href?: string;
  src400: string;
  src800: string;
  src1440: string;
  src4k: string;
  src8k: string;
};