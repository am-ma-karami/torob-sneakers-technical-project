import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpLeft, Globe2, Store } from "lucide-react";
import { api } from "../lib/api";
import { formatNumber, latinDigits } from "../lib/format";
import type { StoreOffersResult } from "../lib/types";

const originalPrice = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const currencies: Record<string, string> = {
  USD: "دلار آمریکا",
  EUR: "یورو",
  GBP: "پوند",
  AUD: "دلار استرالیا",
  IRT: "تومان",
  IRR: "ریال",
};
const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tehran",
});
export function storeDate(value: string | null | undefined) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "نامشخص";
  return dateFormatter.format(new Date(value));
}

export function StoreOffers({ slug }: { slug: string }) {
  const [market, setMarket] = useState<"all" | "iran" | "foreign">("all");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["store-offers", slug, market, page],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        source: "ShoeStoreLinks",
        sort: "price_toman",
        page_size: "6",
        page: String(page),
      });
      if (market !== "all") params.set("market", market);
      return api<StoreOffersResult>(`/shoes/${slug}/offers?${params}`, signal);
    },
  });
  const data = query.data;
  const rateEntries = new Map(
    (data?.items || [])
      .filter((offer) => offer.conversion?.kind === "free_market")
      .map((offer) => [offer.currency!, offer.conversion!]),
  );
  return (
    <section
      id="stores"
      className="panel store-offers"
      aria-labelledby="stores-title"
      aria-busy={query.isFetching}
    >
      <div className="store-offers-heading">
        <div>
          <span className="eyebrow">
            <Store size={15} aria-hidden="true" /> پیدا کردن فروشگاه
          </span>
          <h2 id="stores-title">قیمت و فروشگاه‌ها</h2>
          <p className="fine-print">
            همهٔ قیمت‌ها به تومان هستند. رنگ و سایز را در فروشگاه بررسی کن.
          </p>
        </div>
        <span className="store-price-unit">تومان</span>
      </div>
      <div className="store-markets" role="group" aria-label="بازار فروشگاه">
        {(
          [
            ["all", "همه"],
            ["iran", "ایران"],
            ["foreign", "خارج از ایران"],
          ] as const
        ).map(([key, title]) => {
          const counts = data?.market_counts;
          const count =
            key === "all"
              ? (counts?.iran || 0) + (counts?.foreign || 0)
              : counts?.[key] || 0;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={market === key}
              onClick={() => {
                setMarket(key);
                setPage(1);
              }}
            >
              {title} {data && <span>{formatNumber(count)}</span>}
            </button>
          );
        })}
      </div>
      {query.isPending ? (
        <p role="status" className="store-loading">
          در حال دریافت فروشگاه‌ها…
        </p>
      ) : query.isError ? (
        <div role="alert" className="store-empty">
          <p>فهرست فروشگاه‌ها دریافت نشد.</p>
          <button onClick={() => query.refetch()}>تلاش دوباره</button>
        </div>
      ) : data && data.total > 0 ? (
        <>
          <ul className="store-offer-list">
            {data.items.map((offer) => (
              <li key={offer.key} className="store-offer">
                <div className="store-offer-identity">
                  <span className="store-market-icon" aria-hidden="true">
                    {offer.market === "iran" ? (
                      <Store size={20} />
                    ) : (
                      <Globe2 size={20} />
                    )}
                  </span>
                  <div>
                    <h3 dir="auto">{offer.retailer}</h3>
                    <small>
                      {offer.market === "iran"
                        ? "فروشگاه داخلی"
                        : "فروشگاه خارجی"}
                    </small>
                  </div>
                </div>
                <div className="store-offer-price">
                  <strong>
                    {offer.price_toman != null ? (
                      <>
                        <bdi>{formatNumber(offer.price_toman)}</bdi>{" "}
                        <small>تومان</small>
                      </>
                    ) : (
                      "قیمت نامشخص"
                    )}
                  </strong>
                  {offer.price != null &&
                    offer.currency &&
                    offer.market === "foreign" && (
                      <small>
                        قیمت اصلی:{" "}
                        <bdi>
                          {originalPrice.format(offer.price)}{" "}
                          {currencies[offer.currency] || offer.currency}
                        </bdi>
                      </small>
                    )}
                  {offer.market === "foreign" && offer.price_toman != null && (
                    <small>برآورد با نرخ بازار آزاد</small>
                  )}
                  {offer.price != null && offer.price_toman == null && (
                    <small>نرخ تبدیل در دسترس نیست</small>
                  )}
                </div>
                <div className="store-offer-meta">
                  <span>
                    {offer.availability === "in_stock"
                      ? "موجود در آخرین بررسی"
                      : offer.availability === "out_of_stock"
                        ? "ناموجود در آخرین بررسی"
                        : "موجودی را در فروشگاه بررسی کن"}
                  </span>
                  <small>
                    ثبت اطلاعات:{" "}
                    <bdi>{storeDate(offer.checked_at || offer.snapshot)}</bdi>
                  </small>
                </div>
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="button secondary store-visit"
                  aria-label={`مشاهده در ${offer.retailer}`}
                >
                  {offer.url_type === "model_listing"
                    ? "مشاهدهٔ مدل"
                    : "مشاهده در فروشگاه"}
                  <ArrowUpLeft size={16} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          {data.pages > 1 && (
            <nav className="store-pagination" aria-label="صفحه‌های فروشگاه">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1 || query.isFetching}
              >
                قبلی
              </button>
              <span role="status">
                صفحهٔ {formatNumber(page)} از {formatNumber(data.pages)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pages || query.isFetching}
              >
                بعدی
              </button>
            </nav>
          )}
          {rateEntries.size > 0 && (
            <div className="store-rate-basis">
              <h3>مبنای تبدیل قیمت خارجی</h3>
              {[...rateEntries].map(([currency, conversion]) => (
                <p key={currency}>
                  هر {currencies[currency] || currency}:{" "}
                  <bdi>
                    {formatNumber(Number(conversion.rate_toman_per_unit))}
                  </bdi>{" "}
                  تومان ·{" "}
                  <a
                    href={conversion.source_url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {conversion.source}
                  </a>
                  <small>
                    دریافت نرخ: <bdi>{storeDate(conversion.fetched_at)}</bdi> ·
                    زمان اعلام منبع:{" "}
                    {latinDigits(conversion.source_time_label || "نامشخص")}
                    {conversion.stale
                      ? " · نرخ ذخیره‌شده؛ نیازمند به‌روزرسانی"
                      : ""}
                  </small>
                </p>
              ))}
              <p className="fine-print">
                این مبلغ فقط تبدیل قیمت کالاست؛ هزینهٔ ارسال، مالیات و گمرک در آن
                محاسبه نشده است.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="store-empty">
          برای این مدل در این بازار فروشگاهی پیدا نشد.
        </p>
      )}
    </section>
  );
}
