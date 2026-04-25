import { Navbar } from "../components/layout/Navbar";
import { ProductGrid } from "../components/home/ProductGrid";
import { InfoSection } from "../components/home/InfoSection";
import { Testimonials } from "../components/home/Testimonials";
import { Footer } from "../components/layout/Footer";
import { Hero } from "../components/home/Hero";
import { useEffect, useState } from "react";
import { FullPageLoader } from "../components/Loader";
import { Init } from "../components/init";
import React from "react";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { Shield, Palmtree } from "lucide-react";
import { Button } from "../components/ui/button";

export default function Home() {
  const [showPromoPopup, setShowPromoPopup] = useState(false)
  const [showAgeVerification, setShowAgeVerification] = useState(false)

  useEffect(() => {
      setTimeout(() => {
        setShowAgeVerification(true)
      }, 3000);
  }, [])
  const handleAgeVerified = () => {
    localStorage.setItem("ageVerified", "true")
    setShowAgeVerification(false)
    const hasSeenPromo = sessionStorage.getItem("hasSeenPromo")
    if (!hasSeenPromo) {
      setShowPromoPopup(true)
      sessionStorage.setItem("hasSeenPromo", "true")
    }
  }

  const handleAgeRejected = () => {
    window.location.href = "https://www.google.com"
  }

  return (
    <div dir="rtl" className="min-h-screen bg-black text-white overflow-x-hidden">
      <Navbar />
      <main>
        <Init/>

      <Dialog open={showAgeVerification} onOpenChange={() => setShowAgeVerification(!showAgeVerification)}>
        <DialogContent className="max-w-2xl p-0 gap-0" showCloseButton={false}>
          <div className="flex flex-col items-center bg-background p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-foreground flex items-center justify-center mb-6">
              <div className="text-background">
                <Shield className="w-12 h-12 mb-1" />
                <div className="text-sm font-bold">18+ VERIFY</div>
              </div>
            </div>

            <h2 className="text-3xl font-bold mb-4 text-foreground">
              لاستخدام هذا الموقع، يجب أن يكون عمرك 18 سنة أو أكثر
            </h2>

            <p className="text-lg text-muted-foreground mb-8">يرجى التحقق من عمرك قبل دخول الموقع</p>

            <div className="w-full max-w-md space-y-3 mb-8">
              <Button className="w-full h-14 text-lg font-semibold" size="lg" onClick={handleAgeVerified}>
                18 سنة أو أكثر
              </Button>

              <Button
                variant="outline"
                className="w-full h-14 text-lg font-semibold bg-transparent"
                size="lg"
                onClick={handleAgeRejected}
              >
                اقل من 18 سنة
              </Button>
            </div>

            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              للبالغين فقط +18. هذا المنتج يحتوي على النيكوتين وهو مسبب للإدمان. مخصص فقط للبالغين المستهلكين للنيكوتين
              أو التبغ.
            </p>
          </div>
        </DialogContent>
      </Dialog>

        <Hero />
        <ProductGrid />
        <InfoSection />
        <Testimonials />
      </main>
      <Footer />

      {/* Fixed bottom-right corner badge — matches dzrt.com */}
      <div
        className="pointer-events-none fixed bottom-4 left-4 z-30 hidden sm:flex items-center gap-3"
        data-testid="corner-saudi-badge"
      >
        <div className="text-[10px] leading-tight text-white/60 text-left max-w-[180px]">
          يحتوي هذا المنتج على النيكوتين الذي يسبب الإدمان
        </div>
        <div className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center text-white text-[11px] font-bold bg-black/40">
          18+
        </div>
        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md border border-white/30 bg-black/40 text-white">
          <Palmtree className="h-3.5 w-3.5" />
          <span className="text-[7px] font-bold mt-0.5 leading-none">SAUDI</span>
          <span className="text-[7px] font-bold leading-none mt-0.5">MADE</span>
        </div>
      </div>
    </div>
  );
}
