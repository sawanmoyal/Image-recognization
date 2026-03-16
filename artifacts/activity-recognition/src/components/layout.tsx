import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, List, Activity as ActivityIcon, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Surveillance Feed", icon: ActivityIcon },
    { href: "/events", label: "Event Logs", icon: List },
    { href: "/stats", label: "System Stats", icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/80 backdrop-blur-md flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <ShieldAlert className="w-6 h-6 text-primary mr-3" />
          <h1 className="text-lg font-display tracking-widest text-primary glow-text">
            O.V.E.R.S.E.E.R.
          </h1>
        </div>

        <div className="p-4 flex-1">
          <p className="text-xs font-display text-primary/60 mb-4 tracking-widest uppercase">Modules</p>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center px-4 py-3 rounded-sm transition-all duration-200 group font-display tracking-wide relative overflow-hidden",
                  isActive 
                    ? "bg-primary/10 text-primary border-l-2 border-primary" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}>
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-50" />
                  )}
                  <item.icon className={cn("w-5 h-5 mr-3 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <div className="sci-fi-panel p-3 text-xs font-mono text-muted-foreground flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>SYS.STATUS: ONLINE</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 pointer-events-none bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=2070')] opacity-5 bg-cover bg-center mix-blend-screen" />
        
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-8 z-10">
          <h2 className="text-xl font-display text-primary/80">
            {navItems.find(item => item.href === location)?.label || "Module"}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="text-xs font-mono text-primary/60 text-right">
              <div>DATETIME: {new Date().toISOString().split('T')[0]}</div>
              <div>COORD: 47.6062° N, 122.3321° W</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative z-10 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}
