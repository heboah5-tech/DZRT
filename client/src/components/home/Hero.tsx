"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "wouter";

export function Hero() {
  return (
    <section
      className="relative w-full bg-black min-h-screen flex items-center justify-center overflow-hidden"
      data-testid="section-hero"
    >
      {/* Subtle radial glow - very minimal like dzrt.com */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.08),transparent_55%)]" />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[140px]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.55, 0.4] }}
        transition={{ duration: 9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-28 pb-20 flex flex-col items-center text-center">
        <motion.h1
          className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold font-heading text-white leading-[0.95] tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          اكتشف تجربة{" "}
          <span className="text-primary inline-block">DZRT</span>
        </motion.h1>

        <motion.p
          className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-white/55 max-w-2xl leading-relaxed font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          أكياس نيكوتين فاخرة بنكهات سعودية أصيلة
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="mt-10 sm:mt-12"
        >
          <Button
            asChild
            size="lg"
            className="h-14 px-10 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-[1.02] gap-3"
            data-testid="button-shop-now"
          >
            <Link href="/products">
              تسوق الآن
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </motion.div>

        {/* Hero product image - subtle, floating */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 1.1 }}
          className="relative mt-16 sm:mt-20 w-full max-w-3xl"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
          <motion.img
            src="/hero-banner.webp"
            alt="DZRT"
            className="w-full h-auto object-contain mx-auto drop-shadow-[0_30px_60px_rgba(34,197,94,0.25)]"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </section>
  );
}
