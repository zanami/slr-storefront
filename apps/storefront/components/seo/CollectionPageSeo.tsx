import { NextSeo } from "next-seo";
import { OpenGraphMedia } from "next-seo/lib/types";

import { STOREFRONT_NAME } from "@/lib/const";
import { CollectionDetailsFragment } from "@/saleor/api";

interface CollectionPageSeoProps {
  collection: CollectionDetailsFragment;
}

export function CollectionPageSeo({ collection }: CollectionPageSeoProps) {
  const title = collection?.seoTitle
    ? `${collection?.seoTitle} - ${STOREFRONT_NAME}`
    : STOREFRONT_NAME;
  const seoDescription = collection.seoDescription || "";
  let images: OpenGraphMedia[] = [
    {
      url: "/kuuza-og-image.jpg",
      alt: "Hero image",
    },
  ];
  if (collection.backgroundImage) {
    images = [
      {
        url: collection.backgroundImage.url,
        alt: collection.backgroundImage.alt || "Collection lead image",
      },
      ...images,
    ];
  }
  return (
    <NextSeo
      title={title}
      description={seoDescription}
      openGraph={{
        title,
        description: seoDescription,
        images,
        site_name: STOREFRONT_NAME,
      }}
    />
  );
}

export default CollectionPageSeo;
