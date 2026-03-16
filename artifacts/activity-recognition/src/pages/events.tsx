import { useState } from "react";
import { format } from "date-fns";
import { Download, Trash2, RefreshCw, Filter, Search } from "lucide-react";
import { useListEvents, useClearEvents, exportEvents } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatConfidence, getActivityColor, cn } from "@/lib/utils";

export default function EventsPage() {
  const [filterActivity, setFilterActivity] = useState<string>("");
  const { toast } = useToast();

  const { data, isLoading, refetch, isRefetching } = useListEvents({
    activity: filterActivity || undefined,
    limit: 100
  });

  const clearMutation = useClearEvents({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event Log Purged", description: "All records have been permanently deleted." });
        refetch();
      }
    }
  });

  const handleExport = async () => {
    try {
      const csvString = await exportEvents();
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overseer-events-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      toast({ title: "Export Failed", description: "Could not generate CSV file.", variant: "destructive" });
    }
  };

  const activities = ["", "walking", "sitting", "running", "falling", "using_phone", "fighting"];

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Header Controls */}
        <div className="sci-fi-panel p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select 
                value={filterActivity}
                onChange={(e) => setFilterActivity(e.target.value)}
                className="w-full bg-background border border-border text-foreground font-mono text-sm rounded-sm py-2 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
              >
                <option value="">ALL ACTIVITIES</option>
                {activities.filter(Boolean).map(a => (
                  <option key={a} value={a}>{a.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex space-x-3 w-full md:w-auto">
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefetching && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (window.confirm("Are you sure you want to purge all records? This action cannot be undone.")) {
                  clearMutation.mutate();
                }
              }}
              disabled={clearMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Purge Log
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="sci-fi-panel overflow-x-auto">
          <table className="w-full text-left font-mono text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-black/40">
                <th className="px-6 py-4 text-primary font-display tracking-widest">TIMESTAMP</th>
                <th className="px-6 py-4 text-primary font-display tracking-widest">SUBJECT ID</th>
                <th className="px-6 py-4 text-primary font-display tracking-widest">DETECTED ACTIVITY</th>
                <th className="px-6 py-4 text-primary font-display tracking-widest">CONFIDENCE</th>
                <th className="px-6 py-4 text-primary font-display tracking-widest text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-primary animate-ping rounded-full" />
                      <span>Accessing databanks...</span>
                    </div>
                  </td>
                </tr>
              ) : data?.events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground border-dashed border border-border m-4">
                    NO RECORDS FOUND FOR CURRENT FILTERS
                  </td>
                </tr>
              ) : (
                data?.events.map((event) => {
                  const colors = getActivityColor(event.activity);
                  return (
                    <tr key={event.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {format(new Date(event.timestamp), "yyyy-MM-dd HH:mm:ss")}
                      </td>
                      <td className="px-6 py-4">
                        SUBJ-{String(event.personId).padStart(4, '0')}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={cn("uppercase", colors.bg, colors.text, colors.border, "border")}>
                          {event.activity}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="w-12">{formatConfidence(event.confidence)}</span>
                          <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full", colors.bg.replace('/20', 'bg-opacity-100'))} 
                              style={{ width: `${event.confidence * 100}%`, backgroundColor: colors.text }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                          <Search className="w-4 h-4 mr-2" /> Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {data && (
          <div className="text-right text-xs font-mono text-muted-foreground">
            SHOWING {data.events.length} OF {data.total} RECORDS
          </div>
        )}
      </div>
    </Layout>
  );
}
