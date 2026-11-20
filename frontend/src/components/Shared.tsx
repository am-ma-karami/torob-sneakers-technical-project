import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, RefreshCw, ScanLine } from "lucide-react";
export function ProductImage({
  src,
  name,
  className = "",
  eager = false,
}: {
  src: string | null | undefined;
  name: string;
  className?: string;
  eager?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <img
      src={src}
      alt={name}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setBroken(true)}
    />
  ) : (
    <div
      role="img"
      aria-label={`تصویر ${name} در دسترس نیست`}
      className={`image-fallback ${className}`}
    >
      <ScanLine />
      <span>تصویر در دسترس نیست</span>
    </div>
  );
}
export function ErrorState({ retry }: { retry: () => unknown }) {
  return (
    <div className="state-panel" role="alert">
      <CircleAlert size={32} />
      <h2>ارتباط با کاتالوگ برقرار نشد.</h2>
      <p>اتصال را بررسی کن و دوباره تلاش کن.</p>
      <button className="button" onClick={retry}>
        <RefreshCw size={16} /> تلاش دوباره
      </button>
    </div>
  );
}
export function Loading() {
  return (
    <div
      className="loading-block"
      role="status"
      aria-label="در حال دریافت اطلاعات"
    >
      <div />
      <div />
      <div />
    </div>
  );
}
export function Breadcrumb({
  name,
  category,
}: {
  name: string;
  category?: string;
}) {
  return (
    <nav className="breadcrumb" aria-label="مسیر صفحه">
      <Link to="/">کشف کفش</Link>
      <span>/</span>
      {category && (
        <>
          <Link to={`/?category=${encodeURIComponent(category)}`}>
            دسته‌بندی
          </Link>
          <span>/</span>
        </>
      )}
      <b dir="auto">{name}</b>
    </nav>
  );
}
