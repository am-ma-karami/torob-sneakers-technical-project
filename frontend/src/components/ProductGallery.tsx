import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import type { Shoe } from "../lib/types";
import { colorwayLabel, galleryImages } from "../lib/gallery";
import { fa, label } from "../lib/format";
import { ProductImage } from "./Shared";

export function ProductGallery({
  shoe,
  colorway,
  select,
}: {
  shoe: Shoe;
  colorway: string | null;
  select: (key: string | null) => void;
}) {
  const images = galleryImages(shoe, colorway);
  const [index, setIndex] = useState(0),
    [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLButtonElement>(null),
    touch = useRef<number | null>(null);
  const current = Math.min(index, Math.max(0, images.length - 1));
  const thumbStart = Math.floor(current / 7) * 7;
  const move = (delta: number) =>
    setIndex((i) => (i + delta + images.length) % images.length);
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previous = document.body.style.overflow;
    const returnFocus = opener.current;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = previous;
      returnFocus?.focus();
    };
  }, [open]);
  const choose = (key: string | null) => {
    setIndex(0);
    select(key);
  };
  const selected = shoe.variants.find((v) => v.key === colorway);
  return (
    <div className="product-photo-panel gallery">
      <div className="photo-caption">
        <span>{shoe.summary.brand}</span>
        <span className="tag">{label(shoe.summary.categories[0])}</span>
      </div>
      <button
        ref={opener}
        className="gallery-open"
        aria-label="باز کردن گالری تمام‌صفحه"
        onClick={() => setOpen(true)}
        disabled={!images.length}
      >
        <div className="main-product-image">
          <ProductImage
            key={images[current]}
            src={images[current]}
            name={shoe.summary.name}
            eager
          />
        </div>
        <span className="gallery-expand">
          <Expand size={18} />
        </span>
      </button>
      <div className="photo-thumbnails" aria-label="تصاویر گروه انتخاب‌شده">
        {thumbStart > 0 && (
          <button
            className="thumbnail-page"
            aria-label="تصاویر کوچک قبلی"
            onClick={() => setIndex(Math.max(0, thumbStart - 7))}
          >
            <ChevronRight size={18} />
          </button>
        )}
        {images.slice(thumbStart, thumbStart + 7).map((src, offset) => {
          const i = thumbStart + offset;
          return (
            <button
              key={src}
              aria-label={`تصویر ${fa(i + 1)} محصول`}
              aria-pressed={current === i}
              onClick={() => setIndex(i)}
            >
              <ProductImage
                src={src}
                name={`${shoe.summary.name} · ${i + 1}`}
              />
            </button>
          );
        })}
        {thumbStart + 7 < images.length && (
          <button
            className="thumbnail-page"
            aria-label="تصاویر کوچک بعدی"
            onClick={() => setIndex(thumbStart + 7)}
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>
      <div className="gallery-groups">
        <button aria-pressed={!selected} onClick={() => choose(null)}>
          تصاویر عمومی
        </button>
        {shoe.variants
          .filter((v) => v.image_url)
          .map((v) => (
            <button
              key={v.key}
              aria-label={`رنگ ${colorwayLabel(v)}`}
              title={v.name}
              aria-pressed={selected?.key === v.key}
              onClick={() => choose(v.key)}
            >
              <span
                className="color-dot"
                style={{ background: v.colors[0] || "var(--muted)" }}
              />
              <bdi>{colorwayLabel(v)}</bdi>
            </button>
          ))}
      </div>
      {open && (
        <dialog
          ref={dialog}
          className="gallery-dialog"
          aria-label={`گالری ${shoe.summary.name}`}
          onCancel={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              move(1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              move(-1);
            }
          }}
        >
          <div className="gallery-dialog-bar">
            <span dir="ltr">{shoe.summary.name}</span>
            <button
              autoFocus
              className="icon-button"
              aria-label="بستن گالری"
              onClick={() => setOpen(false)}
            >
              <X />
            </button>
          </div>
          <div
            className="gallery-full-image"
            onTouchStart={(e) => {
              touch.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (
                touch.current != null &&
                Math.abs(e.changedTouches[0].clientX - touch.current) > 40
              )
                move(e.changedTouches[0].clientX < touch.current ? 1 : -1);
              touch.current = null;
            }}
          >
            <ProductImage
              key={images[current]}
              src={images[current]}
              name={shoe.summary.name}
              eager
            />
          </div>
          <div className="gallery-dialog-controls">
            <button
              className="icon-button"
              aria-label="تصویر قبلی"
              disabled={images.length < 2}
              onClick={() => move(-1)}
            >
              <ChevronRight />
            </button>
            <span>
              {selected ? colorwayLabel(selected) : "تصاویر عمومی"} ·{" "}
              {fa(current + 1)} / {fa(images.length)}
            </span>
            <button
              className="icon-button"
              aria-label="تصویر بعدی"
              disabled={images.length < 2}
              onClick={() => move(1)}
            >
              <ChevronLeft />
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
