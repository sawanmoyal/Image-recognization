import { useGetStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Activity, ShieldAlert, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { getActivityColor, formatConfidence } from "@/lib/utils";

export default function StatsPage() {
  const { data, isLoading } = useGetStats();

  if (isLoading || !data) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center">
          <div className="scan-line" />
          <div className="text-primary font-display tracking-widest text-xl animate-pulse glow-text">COMPILING STATISTICS...</div>
        </div>
      </Layout>
    );
  }

  // Enhance data for chart with colors
  const chartData = data.activityBreakdown.map(stat => {
    const colors = getActivityColor(stat.activity);
    // Extract a solid hex/rgb approximation based on the tailwind class for Recharts
    let fill = "#00e5ff"; // default cyan
    if (stat.activity.includes('fall') || stat.activity.includes('fight')) fill = "#ff0000";
    else if (stat.activity.includes('walk')) fill = "#3b82f6";
    else if (stat.activity.includes('sit')) fill = "#22c55e";
    else if (stat.activity.includes('run')) fill = "#eab308";
    else if (stat.activity.includes('phone')) fill = "#f97316";

    return {
      name: stat.activity.toUpperCase(),
      count: stat.count,
      avgConfidence: parseFloat((stat.avgConfidence * 100).toFixed(1)),
      fill
    };
  }).sort((a, b) => b.count - a.count);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="sci-fi-panel p-6 flex flex-col relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
            <div className="flex items-center space-x-4 mb-4 relative z-10">
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-sm">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display tracking-widest text-muted-foreground uppercase text-sm">Total Detections</h3>
            </div>
            <div className="text-5xl font-mono text-foreground font-bold relative z-10">
              {data.totalDetections}
            </div>
          </div>

          <div className="sci-fi-panel p-6 flex flex-col relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-destructive/10 rounded-full blur-2xl group-hover:bg-destructive/20 transition-all" />
            <div className="flex items-center space-x-4 mb-4 relative z-10">
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-display tracking-widest text-muted-foreground uppercase text-sm">Critical Events</h3>
            </div>
            <div className="text-5xl font-mono text-destructive font-bold relative z-10 glow-text-red">
              {data.specialEventsCount}
            </div>
          </div>

          <div className="sci-fi-panel p-6 flex flex-col relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
            <div className="flex items-center space-x-4 mb-4 relative z-10">
              <div className="p-3 bg-secondary border border-border rounded-sm">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display tracking-widest text-muted-foreground uppercase text-sm">Unique Behaviors</h3>
            </div>
            <div className="text-5xl font-mono text-foreground font-bold relative z-10">
              {data.activityBreakdown.length}
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occurrence Chart */}
          <div className="sci-fi-panel p-6 flex flex-col h-[450px]">
            <h3 className="font-display tracking-widest text-primary mb-6 border-b border-border pb-4">FREQUENCY DISTRIBUTION</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={10} 
                    fontFamily="monospace"
                    tickMargin={10}
                  />
                  <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" />
                  <Tooltip 
                    cursor={{fill: '#0f172a'}}
                    contentStyle={{ backgroundColor: '#0a0f1d', border: '1px solid #00e5ff', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#00e5ff' }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Confidence Chart */}
          <div className="sci-fi-panel p-6 flex flex-col h-[450px]">
            <h3 className="font-display tracking-widest text-primary mb-6 border-b border-border pb-4">AVG. CONFIDENCE MATRIX</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} fontFamily="monospace" width={80} />
                  <Tooltip 
                    cursor={{fill: '#0f172a'}}
                    contentStyle={{ backgroundColor: '#0a0f1d', border: '1px solid #00e5ff', fontFamily: 'monospace' }}
                    formatter={(value: number) => [`${value}%`, 'Confidence']}
                  />
                  <Bar dataKey="avgConfidence" radius={[0, 2, 2, 0]} barSize={20}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
