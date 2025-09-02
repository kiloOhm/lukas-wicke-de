export type ImageInfo = {
  src: string,
  alt: string,
  title?: string,
  href?: string
}

export type CollectionInfo = {
  name: string,
  password?: string,
  images: ImageInfo[]
}