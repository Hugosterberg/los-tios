import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { MapPin, MessageCircle, UtensilsCrossed, Star, ChevronRight, ChevronLeft, Languages } from "lucide-react";
import { getPublicRestaurantCopy } from "@/lib/restaurantPublicLocale";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_PLACE_URL, GOOGLE_PLACE_ID, TRIPADVISOR_URL } from "@/lib/mapsPlace";
import { fetchGooglePlaceReviewStats } from "@/lib/googlePlaceStats";
import { FEATURED_GOOGLE_REVIEWS } from "@/data/featuredGoogleReviews";

const WA_HREF = "https://wa.me/529541307386";

/** @param {string} template @param {number | null} rating @param {number | null} count @param {'es' | 'en'} locale */
function formatReviewsGoogleStats(template, rating, count, locale) {
  const localeTag = locale === "es" ? "es-MX" : "en";
  const r = rating != null ? rating.toFixed(1) : "—";
  const c = typeof count === "number" ? count.toLocaleString(localeTag) : "—";
  return template.replace("{rating}", r).replace("{count}", c);
}

/**
 * Marketing shell: header, hero, story, reviews, visit block.
 * Uses site yellow (#facc15) + dark (#1a1a1a) to match the ordering UI.
 */
export default function PublicRestaurantExperience({
  logoSrc,
  restaurantName,
  mobileNavOpen,
  setMobileNavOpen,
  pizzaPatternStyle,
  locale,
  onLocaleChange,
}) {
  const closeNav = useCallback(() => setMobileNavOpen(false), [setMobileNavOpen]);
  const toggleNav = useCallback(() => setMobileNavOpen((open) => !open), [setMobileNavOpen]);
  const t = useMemo(() => getPublicRestaurantCopy(locale), [locale]);

  const [placeStats, setPlaceStats] = useState(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !GOOGLE_PLACE_ID) return;
    let cancelled = false;
    fetchGooglePlaceReviewStats(GOOGLE_MAPS_API_KEY, GOOGLE_PLACE_ID).then((data) => {
      if (!cancelled && data) setPlaceStats(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const closeOnHashChange = () => setMobileNavOpen(false);
    window.addEventListener("hashchange", closeOnHashChange);
    return () => {
      window.removeEventListener("hashchange", closeOnHashChange);
    };
  }, [setMobileNavOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const handleDesktop = (event) => {
      if (event.matches) {
        setMobileNavOpen(false);
      }
    };
    handleDesktop(media);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleDesktop);
      return () => media.removeEventListener("change", handleDesktop);
    }
    media.addListener(handleDesktop);
    return () => media.removeListener(handleDesktop);
  }, [setMobileNavOpen]);

  const scrollReviewsPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollReviewsNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const reviewsStatsLine = useMemo(() => {
    if (!placeStats) return null;
    if (placeStats.rating == null && placeStats.userRatingsTotal == null) return null;
    return formatReviewsGoogleStats(t.reviewsGoogleStats, placeStats.rating, placeStats.userRatingsTotal, locale);
  }, [locale, placeStats, t.reviewsGoogleStats]);

  return (
    <>
      <a
        href="#menu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#1a1a1a] focus:px-4 focus:py-2 focus:text-sm focus:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/80"
      >
        {t.skipToMenu}
      </a>

      <header className="relative sticky top-0 z-40 border-b border-yellow-500/20 bg-[#1a1a1a] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={pizzaPatternStyle}
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <a
            href="#top"
            onClick={closeNav}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl pr-2 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400/70"
          >
            <img
              src={logoSrc}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full border-2 border-yellow-400/50 bg-yellow-400/10 object-contain shadow-md"
            />
            <div className="min-w-0 text-left">
              <p className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">{restaurantName}</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-yellow-400/70">
                Puerto Escondido · Centro
              </p>
            </div>
          </a>

          <div
            className="hidden shrink-0 items-center rounded-full border border-yellow-500/30 bg-black/40 p-0.5 sm:flex"
            role="group"
            aria-label={t.langToggle}
          >
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-yellow-300/75"
            >
              <Languages className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              className={`rounded-full px-2.5 py-1.5 text-xs font-bold transition sm:px-3 ${
                locale === "es"
                  ? "bg-yellow-400 text-[#1a1a1a]"
                  : "text-gray-300 hover:text-white"
              }`}
              aria-pressed={locale === "es"}
              onClick={() => onLocaleChange("es")}
            >
              ES
            </button>
            <button
              type="button"
              className={`rounded-full px-2.5 py-1.5 text-xs font-bold transition sm:px-3 ${
                locale === "en"
                  ? "bg-yellow-400 text-[#1a1a1a]"
                  : "text-gray-300 hover:text-white"
              }`}
              aria-pressed={locale === "en"}
              onClick={() => onLocaleChange("en")}
            >
              EN
            </button>
          </div>

          <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex lg:gap-1">
            <a
              href="#menu"
              className="rounded-full px-2 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5 hover:text-yellow-300 lg:px-3"
            >
              {t.navMenu}
            </a>
            <a
              href="#about"
              className="rounded-full px-2 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5 hover:text-yellow-300 lg:px-3"
            >
              {t.navStory}
            </a>
            <a
              href="#visit"
              className="rounded-full px-2 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5 hover:text-yellow-300 lg:px-3"
            >
              {t.navVisit}
            </a>
            <a
              href="#eventos"
              className="rounded-full px-2 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5 hover:text-yellow-300 lg:px-3"
            >
              {t.navEvents}
            </a>
            <Button asChild className="ml-1 bg-yellow-400 text-[#1a1a1a] hover:bg-yellow-300 lg:ml-2">
              <a href="#menu" className="gap-1.5 font-semibold">
                {t.navOrder} <ChevronRight className="h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-yellow-500/45 bg-[#242424] text-yellow-300 hover:bg-yellow-400/10"
            >
              <a href={WA_HREF} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t.navWhatsApp}
              </a>
            </Button>
          </nav>

          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <div
              className="flex shrink-0 items-center rounded-full border border-yellow-500/30 bg-black/40 p-0.5"
              role="group"
              aria-label={t.langToggle}
            >
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-yellow-300/75"
              >
                <Languages className="h-3.5 w-3.5" />
              </span>
              <button
                type="button"
                className={`rounded-full px-2 py-1.5 text-xs font-bold ${
                  locale === "es" ? "bg-yellow-400 text-[#1a1a1a]" : "text-gray-300"
                }`}
                aria-pressed={locale === "es"}
                onClick={() => onLocaleChange("es")}
              >
                ES
              </button>
              <button
                type="button"
                className={`rounded-full px-2 py-1.5 text-xs font-bold ${
                  locale === "en" ? "bg-yellow-400 text-[#1a1a1a]" : "text-gray-300"
                }`}
                aria-pressed={locale === "en"}
                onClick={() => onLocaleChange("en")}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-gray-100 outline-offset-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400/70 ${
                mobileNavOpen
                  ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-200"
                  : "border-yellow-500/25 bg-[#242424]"
              }`}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-drawer-nav"
              aria-label={mobileNavOpen ? t.navClose || "Close navigation" : t.navOpen}
              onClick={toggleNav}
            >
              <span className="sr-only">{mobileNavOpen ? t.navClose || "Close navigation" : t.navOpen}</span>
              <span className="flex flex-col gap-1.5" aria-hidden>
                <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "translate-y-2 rotate-45" : ""}`} />
                <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "-translate-y-2 -rotate-45" : ""}`} />
              </span>
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <>
            <button
              type="button"
              aria-label={t.navClose || "Close navigation"}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
              onClick={closeNav}
            />
            <div
              id="mobile-drawer-nav"
              className="absolute inset-x-0 top-full z-50 border-t border-yellow-500/20 bg-[#111111]/98 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.5)] md:hidden"
              role="dialog"
              aria-label="Mobile navigation"
            >
              <nav className="mx-auto flex max-w-6xl flex-col gap-2" aria-label="Mobile">
                {t.mobileNav.map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={closeNav}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-gray-100 transition hover:bg-white/5"
                  >
                    {label}
                  </a>
                ))}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <a
                    href="#menu"
                    onClick={closeNav}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3.5 text-base font-semibold text-[#1a1a1a] hover:bg-yellow-300"
                  >
                    <UtensilsCrossed className="h-5 w-5" aria-hidden />
                    {t.navOrder}
                  </a>
                  <a
                    href={WA_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeNav}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-500/30 bg-[#1a1a1a] px-4 py-3.5 text-base font-semibold text-yellow-300 hover:bg-yellow-400/10"
                  >
                    <MessageCircle className="h-5 w-5" aria-hidden />
                    {t.mobileWhatsApp}
                  </a>
                </div>
                <a
                  href={GOOGLE_MAPS_PLACE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeNav}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-500/30 px-4 py-3 text-base font-medium text-gray-100 hover:bg-white/5"
                >
                  <MapPin className="h-5 w-5" aria-hidden />
                  {t.mobileMaps}
                </a>
              </nav>
            </div>
          </>
        ) : null}
      </header>

      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden border-b border-yellow-500/20 bg-[#1a1a1a] px-4 py-10 sm:px-6 sm:py-12"
      >
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-yellow-400/5 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-yellow-500/5 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1
            id="hero-heading"
            className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[2.8rem]"
          >
            {t.heroTitle}
          </h1>
          <h2
            id="hero-subheading"
            className="mx-auto mt-3 max-w-3xl text-xl font-semibold leading-snug text-yellow-400/95 sm:text-2xl md:text-[1.95rem]"
          >
            {t.heroSubtitle}
          </h2>
          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-yellow-500/20 bg-white/[0.02] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.32)] sm:px-5 sm:py-5">
            <div className="grid gap-2.5" lang={locale === "es" ? "es-MX" : "en"}>
              {t.heroBodyParagraphs.map((para, i) => (
                <article
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-left text-[13px] leading-relaxed text-gray-300 sm:text-sm"
                >
                  <span
                    aria-hidden
                    className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400/90 shadow-[0_0_0_3px_rgba(250,204,21,0.15)]"
                  />
                  <span className="break-words">
                    {para}
                  </span>
                </article>
              ))}
            </div>
          </div>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              asChild
              size="lg"
              className="h-12 min-w-[11rem] bg-yellow-400 text-base font-semibold text-[#1a1a1a] shadow-lg shadow-black/30 hover:bg-yellow-300"
            >
              <a href="#menu" className="gap-2">
                <UtensilsCrossed className="h-5 w-5" aria-hidden />
                {t.ctaOrder}
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 min-w-[11rem] border-yellow-500/45 bg-[#242424] text-base font-semibold text-yellow-300 hover:bg-yellow-400/10"
            >
              <a href={WA_HREF} target="_blank" rel="noopener noreferrer" className="gap-2">
                <MessageCircle className="h-5 w-5" aria-hidden />
                {t.ctaWa}
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 min-w-[11rem] border-yellow-500/30 bg-black/20 text-base font-semibold text-gray-100 hover:bg-white/5"
            >
              <a href="#visit" className="gap-2">
                <MapPin className="h-5 w-5" aria-hidden />
                {t.ctaDirections}
              </a>
            </Button>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-[11px] text-gray-500">{t.heroFootnote}</p>
        </div>
      </section>

      <section
        id="reviews"
        aria-labelledby="reviews-heading"
        className="scroll-mt-24 border-b border-yellow-500/20 bg-[#1a1a1a] px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="reviews-heading" className="text-2xl font-bold text-white sm:text-3xl">
                {t.reviewsTitle}
              </h2>
              {reviewsStatsLine ? (
                <p className="mt-2 text-sm font-medium text-yellow-400/90">{reviewsStatsLine}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 sm:pt-1">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/35 bg-[#242424] text-yellow-300 transition hover:bg-yellow-400/10 disabled:pointer-events-none disabled:opacity-35"
                aria-label={t.reviewsPrev}
                disabled={!canScrollPrev}
                onClick={scrollReviewsPrev}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/35 bg-[#242424] text-yellow-300 transition hover:bg-yellow-400/10 disabled:pointer-events-none disabled:opacity-35"
                aria-label={t.reviewsNext}
                disabled={!canScrollNext}
                onClick={scrollReviewsNext}
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-10 overflow-hidden" ref={emblaRef}>
            <ul className="flex touch-pan-y gap-4" role="list">
              {FEATURED_GOOGLE_REVIEWS.map((r) => {
                const text = locale === "en" ? r.textEn : r.textEs;
                return (
                  <li
                    key={r.id}
                    className="min-w-0 shrink-0 grow-0 basis-[min(100%,340px)] sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.67rem)]"
                  >
                    <blockquote className="flex h-full min-h-[220px] flex-col rounded-2xl border border-yellow-500/20 bg-[#242424] p-6">
                      <div
                        className="mb-3 flex gap-0.5"
                        role="img"
                        aria-label={locale === "es" ? "5 de 5 estrellas" : "5 out of 5 stars"}
                      >
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden />
                        ))}
                      </div>
                      <p className="flex-1 text-sm leading-relaxed text-gray-300">&ldquo;{text}&rdquo;</p>
                      <footer className="mt-4 flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-yellow-500/95">{r.author}</span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                          {t.reviewsGoogleSource}
                        </span>
                      </footer>
                    </blockquote>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-8 text-center text-xs text-gray-500">
            {t.reviewsFooterBefore}{" "}
            <a
              href={GOOGLE_MAPS_PLACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 underline-offset-2 hover:underline"
            >
              {t.reviewsFooterGoogle}
            </a>{" "}
            {t.reviewsFooterOr}{" "}
            <a
              href={TRIPADVISOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 underline-offset-2 hover:underline"
            >
              {t.reviewsFooterTripadvisor}
            </a>{" "}
            {t.reviewsFooterOr}{" "}
            <a href="https://www.instagram.com/lostios.pxm" className="text-yellow-400 underline-offset-2 hover:underline">
              {t.reviewsFooterInsta}
            </a>
            {t.reviewsFooterAfter}
          </p>
        </div>
      </section>

    </>
  );
}
