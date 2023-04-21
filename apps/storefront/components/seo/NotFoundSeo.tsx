import { NextSeo } from "next-seo";

import { STOREFRONT_NAME } from "@/lib/const";

export function NotFoundSeo() {
  const title = `Page Not found - ${STOREFRONT_NAME}`;
  const description = "Page not found.";

  return (
    <NextSeo
      title={title}
      description={description}
      openGraph={{
        title,
        description,
        images: [
          {
            url: "/kuuza-og-image.jpg",
            alt: "Kuuzamart",
          },
        ],
        site_name: "Kuuzamart",
      }}
    />
  );
}

export default NotFoundSeo;
