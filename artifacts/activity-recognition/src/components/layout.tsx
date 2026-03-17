import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { List, LayoutDashboard, Activity, ShieldAlert, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Image Analysis", icon: Activity },
  { href: "/webcam", label: "Live Webcam", icon: Video },
  { href: "/events", label: "Event Logs", icon: List },
  { href: "/stats", label: "System Stats", icon: LayoutDashboard },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const activeLabel = navItems.find((item) => item.href === location)?.label ?? "Module";

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/80 backdrop-blur-md flex flex-col z-20 shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border gap-3">
          <ShieldAlert className="w-6 h-6 text-primary shrink-0" />
          <h1 className="text-lg font-display tracking-widest text-primary glow-text">O.V.E.R.S.E.E.R.</h1>
        </div>

        {/* Version badge */}
        <div className="px-6 py-3 border-b border-border/40">
          <div className="text-[10px] font-mono text-muted-foreground/50 tracking-widest">
            HUMAN ACTIVITY RECOGNITION v2.0
          </div>
          <div className="text-[10px] font-mono text-primary/50 tracking-widest mt-0.5">
            MediaPipe · PyTorch · OpenCV
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-[10px] font-mono text-primary/50 mb-3 tracking-widest uppercase px-1">Navigation</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-3 rounded-sm transition-all duration-200 group font-mono text-sm relative overflow-hidden",
                    isActive
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-l-2 border-transparent"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/15 to-transparent" />
                  )}
                  <item.icon
                    className={cn(
                      "w-4 h-4 mr-3 shrink-0 transition-colors relative z-10",
                      isActive ? "text-primary" : "group-hover:text-primary"
                    )}
                  />
                  <span className="relative z-10">{item.label}</span>
                  {item.href === "/webcam" && (
                    <span className="ml-auto relative z-10 text-[9px] font-mono bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded tracking-wider">
                      LIVE
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom status */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="sci-fi-panel p-3 text-xs font-mono text-muted-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>SYS.STATUS: ONLINE</span>
          </div>
          <div className="sci-fi-panel p-3 text-[10px] font-mono text-muted-foreground/60 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>FLASK AI: ACTIVE :5000</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden min-w-0">
        {/* Background accent */}
        <div className="absolute inset-0 pointer-events-none bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=2070')] opacity-[0.03] bg-cover bg-center mix-blend-screen" />

        {/* Header */}
        <header className="h-14 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h2 className="text-sm font-mono text-primary/80 tracking-widest uppercase">{activeLabel}</h2>
          </div>
          <div className="text-[10px] font-mono text-primary/40 text-right space-y-0.5">
            <div>UTC: {new Date().toISOString().replace("T", " ").split(".")[0]}</div>
            <div>AI ENGINE: MediaPipe Pose + PyTorch MLP</div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}
