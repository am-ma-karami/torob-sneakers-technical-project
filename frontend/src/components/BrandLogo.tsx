import { useState } from "react";
import logos from "../lib/brandLogos.json";
export const brandLogos: Record<
  string,
  { src: string; source: string; carrier?: boolean }
> = logos;
export function BrandLogo({ brand }: { brand: string }) {
  const logo = brandLogos[brand];
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={`brand-logo ${logo && !broken ? `has-mark${logo.carrier ? " has-carrier" : ""}` : "wordmark-fallback"}`}
    >
      {logo && !broken ? (
        <img
          src={logo.src}
          alt={`نشان ${brand}`}
          loading="lazy"
          width="80"
          height="48"
          onError={() => setBroken(true)}
        />
      ) : (
        <span dir="ltr" aria-label={`نام برند ${brand}`}>
          {brand}
        </span>
      )}
    </span>
  );
}
