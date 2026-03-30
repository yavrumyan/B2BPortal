import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Banner {
  id: string;
  imageUrl: string;
  redirectUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export default function BannerPopup() {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ["/api/banners"],
    staleTime: 60_000,
  });

  // Show popup as soon as we have at least one active banner
  useEffect(() => {
    if (banners.length > 0) setVisible(true);
  }, [banners.length]);

  if (!visible || banners.length === 0) return null;

  const current = banners[index];
  const total = banners.length;

  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  const handleImageClick = () => {
    if (current.redirectUrl) {
      window.open(current.redirectUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setVisible(false)}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => setVisible(false)}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100 transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4 text-gray-700" />
        </button>

        {/* Image */}
        <img
          src={current.imageUrl}
          alt="Рекламный баннер"
          className={`block max-w-[90vw] max-h-[85vh] w-auto h-auto rounded-lg shadow-2xl object-contain ${
            current.redirectUrl ? "cursor-pointer" : "cursor-default"
          }`}
          onClick={handleImageClick}
          draggable={false}
        />

        {/* Carousel controls — only shown when multiple banners */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors"
              aria-label="Предыдущий"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors"
              aria-label="Следующий"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === index ? "bg-white" : "bg-white/50"
                  }`}
                  aria-label={`Баннер ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
