import { ChipButton } from "@saleor/ui-kit";
import React from "react";

// import { Box } from "../Box";
import { RichText } from "../RichText";

export interface PageHeroProps {
  title: string;
  description?: string;
  pills?: {
    label: string;
    onClick: () => void;
  }[];
}

export function PageHero({ title, description, pills = [] }: PageHeroProps) {
  return (
    <div>
      <div className="sm:mx-20 sm:text-center">
        <h1 className="text-5xl font-bold mb-4" data-testid={`titleOf${title}`}>
          {title}
        </h1>

        {description && (
          <div className="sm:text-lg  sm:my-6 text-main-1">
            <RichText jsonStringData={description} />
          </div>
        )}
        {pills.length > 0 && (
          <div className="flex gap-2 flex-wrap sm:justify-center">
            {pills.map((pill) => (
              <ChipButton key={pill.label} label={pill.label} onClick={pill.onClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHero;
