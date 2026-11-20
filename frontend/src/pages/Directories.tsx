import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Footprints } from "lucide-react";
import { api } from "../lib/api";
import type { Taxonomy } from "../lib/types";
import { fa } from "../lib/format";
import { Breadcrumb, ErrorState, Loading } from "../components/Shared";
export function Directory({ kind }: { kind: "brands" | "categories" }) {
  const query = useQuery({
    queryKey: ["taxonomy"],
    queryFn: ({ signal }) => api<Taxonomy>("/taxonomy", signal),
  });
  const title = kind === "brands" ? "همه برندها" : "برای هر مسیر، یک دسته";
  return (
    <>
      <Breadcrumb name={title} />
      <div className="page-heading">
        <span className="eyebrow">کاتالوگ راد</span>
        <h1>{title}</h1>
        <p>
          دسته یا برند را انتخاب کن و با اندازه‌ها و ویژگی‌های واقعی، انتخابت را
          دقیق‌تر کن.
        </p>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <div className="directory-grid">
          {query.data[kind].map((c) => (
            <Link
              key={c.value}
              to={`/?${kind === "brands" ? "brand" : "category"}=${encodeURIComponent(c.value)}#catalog`}
            >
              <Footprints size={20} />
              <b dir="auto">{c.label}</b>
              <span>{fa(c.count)} کفش</span>
              <ChevronLeft size={18} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
export function About() {
  return (
    <>
      <Breadcrumb name="داده‌ها و روش‌ها" />
      <article className="about-page panel">
        <span className="eyebrow">
          انتخاب آگاهانه از داده قابل پیگیری شروع می‌شود
        </span>
        <h1>داده‌ها، روش‌ها و محدودیت‌ها</h1>
        <p>
          راد ۱٬۱۶۷ مدل پایه از RunRepeat را به صورت مجزا نگه می‌دارد. ۲۳۹ مدل
          با ShoeGeometry و ۱۰۹ مدل با SoleHunt تطبیق داده شده‌اند. نسل، مدل
          کودک، نسخه ضدآب و اطلاعات عرض جایگزین مدل دیگر نشده‌اند.
        </p>
        <h2>هر عدد چه معنایی دارد؟</h2>
        <p>
          اندازه‌گیری آزمایشگاهی، مشخصات اعلام سازنده، مقدار محاسبه‌شده و تخمین
          عکس برچسب‌های جدا دارند. روش قدیمی عرض پنجه، معادل عرض داخلی روش فعلی
          نیست. Asker C و Shore A و Shore C مقیاس‌های متفاوتی‌اند. BR درصد نیست.
          امتیاز منابع میانگین نشده است.
        </p>
        <h2>نمودارها چگونه ساخته شده‌اند؟</h2>
        <p>
          تصویر لایه‌ها، رویه و خطوط اتصال شماتیک است؛ CAD، اسکن یا قالب واقعی
          کارخانه نداریم. ارتفاع‌ها و طول راکر با داده تغییر می‌کنند. تخمین‌های
          عکس ShoeGeometry بر طول مرجع ۳۰۰ میلی‌متر تکیه دارند و برای تمام
          سایزها دقیق نیستند. در نبود داده راکر، فقط مقطع ساده ارتفاع نشان داده
          می‌شود.
        </p>
        <h2>قیمت‌ها و رنگ‌ها</h2>
        <p>
          قیمت‌ها و پیشنهادها اسنپ‌شات برداشت ۲۰ نوامبر ۲۰۲۶ هستند؛ زنده تأیید
          نشده‌اند. MSRP دلاری و پیشنهادهای یورویی جدا می‌مانند. رنگ‌ها از رکورد
          رنگ فروشگاه با شناسه متناظر استخراج شده‌اند. رنگ ثبت‌نشده یعنی نامشخص.
          جدول سایز برند، موجودی فروشگاه نیست.
        </p>
        <h2>منابع و اعتبار</h2>
        <p>
          <a
            href="https://runrepeat.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            RunRepeat
          </a>
          : اندازه‌گیری آزمایشگاهی، مشخصات، متن مزایا و ملاحظات و لینک تصاویر.
          حقوق منبع محفوظ است.
        </p>
        <p dir="ltr">
          <a
            href="https://shoegeometry.com/data"
            target="_blank"
            rel="noopener noreferrer"
          >
            ShoeGeometry (2026)
          </a>
          . Running-shoe geometry dataset, version 2026-11-14. CC BY 4.0.
          Geometry data adapted into schematic diagrams; original laboratory
          publisher is credited per metric.
        </p>
        <p dir="ltr">
          <a
            href="https://solehunt.app/data"
            target="_blank"
            rel="noopener noreferrer"
          >
            SoleHunt
          </a>{" "}
          public dataset. CC BY 4.0. Source-specific reported values retained
          separately.
        </p>
        <p>
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            متن مجوز CC BY 4.0
          </a>{" "}
          · پیوند اختصاصی هر کفش در صفحه آن قابل مشاهده است. تصاویر از سرور منبع
          نمایش داده می‌شوند؛ تغییر پیوند یا محدودیت منبع می‌تواند آن‌ها را از
          دسترس خارج کند.
        </p>
      </article>
    </>
  );
}
