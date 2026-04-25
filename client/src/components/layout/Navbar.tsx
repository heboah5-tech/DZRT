import { Link } from "wouter";
import { ShoppingBag, Menu, Search, ChevronDown, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cartContext";

const navLinks = [
  { href: "/", label: "الاشتراكات", testId: "link-subscriptions" },
  { href: "/", label: "المدونة", testId: "link-blog" },
  { href: "/", label: "قصتنا", testId: "link-about" },
  { href: "/", label: "الدعم", testId: "link-support", hasDropdown: true },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "py-3" : "py-4 md:py-5"
      )}
      data-testid="nav-main"
    >
      <div className="px-4 sm:px-6 md:px-10 flex items-center justify-between gap-3" dir="rtl">
        {/* RIGHT (first in RTL): Logo */}
        <Link href="/">
          <span
            className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-white cursor-pointer hover:text-primary transition-colors order-1"
            data-testid="link-logo"
          >
            دزرت
          </span>
        </Link>

        {/* LEFT (last in RTL): Login + cart + lang + search */}
        <div className="flex items-center gap-2 sm:gap-3 order-3">
          {/* Login pill (outlined green) */}
          <Button
            asChild
            variant="outline"
            className="hidden sm:inline-flex h-10 px-5 rounded-full border-primary/60 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary font-semibold text-sm bg-transparent"
            data-testid="button-login"
          >
            <Link href="/checkout">تسجيل الدخول</Link>
          </Button>

          {/* Cart bag */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={`عرض السلة${itemCount > 0 ? ` (${itemCount})` : ""}`}
            className="text-white hover:bg-white/10 rounded-full border border-white/15 h-10 w-10 relative"
            data-testid="button-cart"
          >
            <Link href="/checkout">
              <ShoppingBag className="h-4 w-4" />
              {itemCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-primary rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-lg shadow-primary/40"
                  data-testid="text-cart-count"
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
          </Button>

          {/* Language flag */}
          <button
            type="button"
            aria-label="تغيير اللغة"
            className="hidden sm:flex h-10 w-10 rounded-full border border-white/15 items-center justify-center overflow-hidden bg-white/5 hover:bg-white/10 transition-colors"
            data-testid="button-lang"
          >
            <span className="text-base" aria-hidden>🇬🇧</span>
          </button>

          {/* Search */}
          <button
            type="button"
            aria-label="بحث"
            className="h-10 w-10 rounded-full border border-white/15 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            data-testid="button-search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="فتح القائمة"
                className="text-white hover:bg-white/10 rounded-full border border-white/15 h-10 w-10 md:hidden"
                data-testid="button-menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-black border-white/10 text-white w-[300px]">
              <div className="flex items-center justify-between mb-10">
                <span className="text-2xl font-bold font-heading">دزرت</span>
              </div>
              <nav className="flex flex-col gap-1 text-right">
                {navLinks.map((link) => (
                  <Link
                    key={link.testId}
                    href={link.href}
                    className="text-base font-medium px-4 py-3 rounded-xl hover:bg-white/5 hover:text-primary transition-colors"
                    data-testid={`mobile-${link.testId}`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/products"
                  className="mt-3 text-base font-bold px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-center transition-colors"
                  data-testid="mobile-link-store"
                >
                  المتجر
                </Link>
              </nav>
              <div className="mt-8 pt-6 border-t border-white/10 space-y-2">
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-12 rounded-full font-semibold border-primary/60 text-primary bg-transparent hover:bg-primary/10"
                  data-testid="mobile-button-login"
                >
                  <Link href="/checkout">
                    <LogIn className="h-4 w-4" />
                    تسجيل الدخول
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* CENTER: Pill nav + green store button */}
        <div
          className={cn(
            "hidden md:flex items-center gap-1 rounded-full p-1.5 pr-2 backdrop-blur-xl border transition-all order-2",
            scrolled
              ? "bg-black/70 border-white/15 shadow-xl shadow-black/40"
              : "bg-black/40 border-white/10"
          )}
        >
          <Button
            asChild
            className="h-9 px-5 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md shadow-primary/30"
            data-testid="link-store"
          >
            <Link href="/products">المتجر</Link>
          </Button>
          {navLinks.map((link) => (
            <Link
              key={link.testId}
              href={link.href}
              className="text-sm font-medium text-white/85 hover:text-white px-3.5 py-2 rounded-full hover:bg-white/10 transition-all flex items-center gap-1"
              data-testid={link.testId}
            >
              {link.label}
              {link.hasDropdown && <ChevronDown className="h-3 w-3 opacity-60" />}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
