import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layers, Database, Compass, ArrowRightLeft, Menu, X, Search } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/stack-builder", label: "Stack Builder", icon: Layers },
    { href: "/blueprint", label: "Blueprint", icon: Compass },
    { href: "/catalog", label: "Tool Catalog", icon: Database },
    { href: "/migration", label: "Migration", icon: ArrowRightLeft },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4 md:px-8 mx-auto">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                S
              </div>
              <span className="hidden font-bold sm:inline-block tracking-tight">
                Stackfast<span className="text-primary">2026</span>
              </span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors hover:text-foreground/80 flex items-center gap-2 ${
                    location.startsWith(item.href)
                      ? "text-foreground"
                      : "text-foreground/60"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-1 items-center justify-end space-x-2">
            <div className="w-full flex-1 md:w-auto md:flex-none max-w-sm hidden sm:block">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search tools..."
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9 md:w-[300px] lg:w-[400px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      window.location.href = `/catalog?q=${e.currentTarget.value}`;
                    }
                  }}
                />
              </div>
            </div>
            <nav className="flex items-center">
              <button 
                className="md:hidden p-2 text-foreground/60 hover:text-foreground"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                <span className="sr-only">Toggle Menu</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-border/40 bg-background/95 backdrop-blur px-4 py-4 space-y-4">
          <div className="relative mb-4 sm:hidden">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search tools..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  window.location.href = `/catalog?q=${e.currentTarget.value}`;
                  setIsMobileMenuOpen(false);
                }
              }}
            />
          </div>
          <nav className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`transition-colors hover:text-foreground/80 flex items-center gap-2 text-sm font-medium p-2 rounded-md ${
                  location.startsWith(item.href)
                    ? "bg-muted text-foreground"
                    : "text-foreground/60"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <main className="flex-1 w-full max-w-screen-2xl mx-auto p-4 md:p-8">
        {children}
      </main>

      <footer className="py-6 md:px-8 md:py-0 border-t border-border/40 mt-auto">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row max-w-screen-2xl mx-auto">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by Antigravity for the Stackfast 2026 Rewrite.
          </p>
        </div>
      </footer>
    </div>
  );
}
