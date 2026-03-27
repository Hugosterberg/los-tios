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
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
              {lang === "en" ? "Share link" : "Copiar link"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}