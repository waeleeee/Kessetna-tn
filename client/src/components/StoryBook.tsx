import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PageData {
  image: string;
  text: string;
}

interface StoryBookProps {
  pages: PageData[];
}

export const StoryBook: React.FC<StoryBookProps> = ({ pages }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [direction, setDirection] = useState(0); // 1 for next, -1 for prev

  const nextPage = () => {
    if (currentIndex < pages.length - 1 && !isFlipping) {
      setDirection(1);
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setIsFlipping(false);
      }, 800);
    }
  };

  const prevPage = () => {
    if (currentIndex > 0 && !isFlipping) {
      setDirection(-1);
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setIsFlipping(false);
      }, 800);
    }
  };

  const currentPage = pages[currentIndex];
  const nextPageData = pages[currentIndex + 1];
  const prevPageData = pages[currentIndex - 1];

  return (
    <div className="flex flex-col items-center gap-12 py-10 w-full overflow-hidden" dir="rtl">
      <div className="book-container">
        <div className="book">
          {/* Left Page (Always Image) */}
          <div className="book-page-static left">
            <div className="page-content-wrapper">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  src={currentPage.image}
                  className="page-image-full"
                />
              </AnimatePresence>
              <div className="page-number-indicator">{currentIndex * 2 + 1}</div>
            </div>
          </div>

          {/* Right Page (Always Text) */}
          <div className="book-page-static right">
            <div className="page-text-container">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5 }}
                  className="prose prose-2xl max-w-none"
                >
                  <p className="text-right text-3xl leading-relaxed text-slate-800 font-medium">
                    {currentPage.text}
                  </p>
                </motion.div>
              </AnimatePresence>
              <div className="page-number-indicator">{currentIndex * 2 + 2}</div>
            </div>
          </div>

          {/* Spine effect */}
          <div className="book-spine-line" />

          {/* Flipping Leaf (Visual only during transition) */}
          {isFlipping && (
            <div className={`book-flipping-leaf ${direction === 1 ? "flipped" : ""}`}>
              <div className="leaf-front">
                {direction === 1 ? (
                  <div className="page-text-container">
                     <p className="text-right text-3xl leading-relaxed text-slate-800 font-medium opacity-50">
                      {currentPage.text}
                    </p>
                  </div>
                ) : (
                  <div className="page-content-wrapper">
                    <img src={currentPage.image} className="page-image-full opacity-50" />
                  </div>
                )}
              </div>
              <div className="leaf-back">
                {direction === 1 ? (
                  <div className="page-content-wrapper">
                    <img src={nextPageData?.image} className="page-image-full" />
                  </div>
                ) : (
                  <div className="page-text-container">
                    <p className="text-right text-3xl leading-relaxed text-slate-800 font-medium">
                      {prevPageData?.text}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex gap-10 items-center mt-12 bg-[#FFF9F2]/90 backdrop-blur-md p-6 rounded-[2.5rem] shadow-2xl border border-[#8B4513]/10 relative z-10">
        <button
          onClick={nextPage}
          disabled={currentIndex >= pages.length - 1 || isFlipping}
          className="group flex items-center gap-3 px-8 py-5 bg-[#8B4513] text-white rounded-2xl shadow-lg hover:bg-[#703610] disabled:opacity-30 transition-all hover:scale-105 active:scale-95 border-b-4 border-[#5D2E0D]"
          title="المشهد التالي"
        >
          <span className="font-black text-2xl">التالي</span>
          <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
        </button>
        
        <div className="flex flex-col items-center min-w-[150px]">
          <div className="text-4xl font-black text-[#5D2E0D] font-['Playfair_Display']">
            {currentIndex + 1} <span className="text-2xl text-[#8B4513]/50 mx-1">/</span> {pages.length}
          </div>
          <span className="text-xs font-black text-[#8B4513]/40 uppercase tracking-[0.3em] mt-1">SCENE</span>
        </div>

        <button
          onClick={prevPage}
          disabled={currentIndex === 0 || isFlipping}
          className="group flex items-center gap-3 px-8 py-5 bg-[#A0522D] text-white rounded-2xl shadow-lg hover:bg-[#8B4513] disabled:opacity-30 transition-all hover:scale-105 active:scale-95 border-b-4 border-[#703610]"
          title="المشهد السابق"
        >
          <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-black text-2xl">السابق</span>
        </button>
      </div>
    </div>
  );
};
