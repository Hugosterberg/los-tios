import React, { useState } from "react";

export default function EventShareButtons({ title, text, url, lang = "es" }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || window.location.href;
  const shareText = `${title} - ${text}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
      } catch {
        // cancelled
      }
    } else {
      // Fallback: open WhatsApp share on desktop
      const encoded = encodeURIComponent(`${shareText} ${shareUrl}`);
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleInstagramStory = () => {
    // Copy to clipboard first
    navigator.clipboard.writeText(shareUrl).then(() => {
      // Open Instagram app/web
      window.open('https://instagram.com/', '_blank');
    });
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-1.5 px-3 h-7 rounded-full bg-yellow-400/20 hover:bg-yellow-400/40 border border-yellow-400/40 text-yellow-400 text-[10px] font-semibold transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="block w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {lang === "en" ? "Share" : "Compartir"}
        </button>

        <button
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-1.5 px-3 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/60 text-[10px] font-semibold transition-all"
        >
          {copied ? (
            <>✓ {lang === "en" ? "Copied!" : "Copiado!"}</>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="block w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {lang === "en" ? "Copy link" : "Copiar link"}
            </>
          )}
        </button>

        <button
          onClick={handleInstagramStory}
          className="inline-flex items-center justify-center gap-1.5 px-3 h-7 rounded-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-80 text-white text-[10px] font-semibold transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="block w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
          </svg>
          {lang === "en" ? "Story" : "Story"}
        </button>
      </div>
    </div>
  );
}