import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "Features", hash: "#features" },
  { name: "How It Works", hash: "#how-it-works" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    if (!isLanding) {
      setIsAtTop(false);
      return;
    }

    const update = () => {
      setIsAtTop(window.scrollY <= 20);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isLanding]);

  const isHeroTop = isLanding && isAtTop;

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      isHeroTop
        ? "bg-transparent"
        : "bg-background/95 backdrop-blur-lg border-b border-border shadow-sm"
    )}>
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105",
              isHeroTop ? "bg-accent/20" : "bg-primary"
            )}>
              <FileText className={cn(
                "w-5 h-5",
                isHeroTop ? "text-accent-foreground" : "text-primary-foreground"
              )} />
            </div>
            <span className={cn(
              "text-xl font-bold",
              isHeroTop ? "text-primary-foreground" : "text-foreground"
            )}>
              Invoicy
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={isLanding ? link.hash : `/${link.hash}`}
                className={cn(
                  "font-medium transition-colors animated-underline",
                  isHeroTop 
                    ? "text-primary-foreground/80 hover:text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <Link to="/login">
              <Button 
                variant={isHeroTop ? "hero-outline" : "ghost"}
                className={isLanding ? "" : ""}
              >
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button variant={isHeroTop ? "hero" : "default"}>
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className={cn("w-6 h-6", isHeroTop ? "text-primary-foreground" : "text-foreground")} />
            ) : (
              <Menu className={cn("w-6 h-6", isHeroTop ? "text-primary-foreground" : "text-foreground")} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={isLanding ? link.hash : `/${link.hash}`}
                  className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-4 border-t border-border space-y-2">
                <Link to="/login" className="block" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Link to="/register" className="block" onClick={() => setIsOpen(false)}>
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
