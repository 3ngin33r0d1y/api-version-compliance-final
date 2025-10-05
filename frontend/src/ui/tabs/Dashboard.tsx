import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { Activity, Server, Globe, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Clock, Zap, Shield, Eye, Settings } from 'lucide-react';
import { useData, computeMetrics, filterApis } from '../useData';
import { ApiResponse, checkServiceCompliance, normalizeEnvironment } from "../../lib/compliance";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function Dashboard() {
  const { state, reload } = useData(true);
  const [projectId, setProjectId] = useState<number | 'all'>('all');
  const [env, setEnv] = useState<'all' | 'dev' | 'staging' | 'prod'>('all');
  const [region, setRegion] = useState<'all' | 'paris-1' | 'paris-2' | 'north-1'>('all');
  const [complianceScore, setComplianceScore] = useState<number>(100);

  const filtered = useMemo(() => filterApis(state.apis, projectId, env, region), [state.apis, projectId, env, region]);
  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);

  // Helper functions - SAME AS COMPLIANCE TAB
  const extractServiceFromUrl = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.split(".")[0] || "unknown-service";
    } catch {
      return "unknown-service";
    }
  };

  const fetchWithTimeout = async (url: string, ms = 8000): Promise<Response> => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(id);
    }
  };

  const safeJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  };

  // Calculate compliance score - EXACT SAME LOGIC AS COMPLIANCE TAB
  const calculateComplianceScore = async () => {
    try {
      const serviceGroups: Record<string, Record<string, ApiResponse>> = {};
      const apis = filtered;

      // Fetch everything in parallel - SAME AS COMPLIANCE TAB
      const results = await Promise.allSettled(
          apis.map(async (apiItem) => {
            let response: Response | null = null;
            let data: any = {};
            try {
              response = await fetchWithTimeout(apiItem.url);
              data = await safeJson(response);
            } catch {
              // keep response null
            }

            const envKey = normalizeEnvironment(apiItem.environment);
            const serviceName = data?.service || extractServiceFromUrl(apiItem.url);
            const projectName =
                state.projects.find((p) => p.id === apiItem.projectId)?.name || "Unknown Project";
            const serviceKey = `${serviceName}-${apiItem.projectId}`;

            if (!serviceGroups[serviceKey]) serviceGroups[serviceKey] = {};

            serviceGroups[serviceKey][envKey] = {
              service: serviceName,
              version: typeof data?.version === "string" && data.version.trim() ? data.version : "0.0.0",
              url: apiItem.url,
              status: response?.ok ? "online" : "offline",
              environment: envKey,
              region: apiItem.region || "unknown",
              responseTime: response ? Math.floor(Math.random() * 200) + 50 : 0,
              projectId: apiItem.projectId,
              projectName,
            };
          })
      );

      // Run compliance per grouped service - SAME AS COMPLIANCE TAB
      const violations: any[] = [];
      for (const [, envs] of Object.entries(serviceGroups)) {
        violations.push(...checkServiceCompliance(envs));
      }

      // Calculate metrics - SAME AS COMPLIANCE TAB
      const totalServices = Object.keys(serviceGroups).length;
      const servicesWithViolations = new Set(violations.map((v) => `${v.service}-${v.projectName}`)).size;
      const compliantServices = Math.max(totalServices - servicesWithViolations, 0);
      const calculatedScore = totalServices > 0 ? Math.round((compliantServices / totalServices) * 100) : 100;

      setComplianceScore(calculatedScore);
    } catch (error) {
      console.error('Error calculating compliance score:', error);
      setComplianceScore(0);
    }
  };

  // Update compliance score when filtered data changes
  useEffect(() => {
    if (filtered.length > 0) {
      calculateComplianceScore();
    } else {
      setComplianceScore(100);
    }
  }, [filtered]);

  // Enhanced metrics calculations
  const enhancedMetrics = useMemo(() => {
    const onlineApis = filtered.filter(api => api.status === 'online');
    const offlineApis = filtered.filter(api => api.status === 'offline');
    const avgResponseTime = onlineApis.length > 0
        ? onlineApis.reduce((sum, api) => sum + (api.responseTime || 0), 0) / onlineApis.length
        : 0;

    // Environment distribution
    const envDistribution = filtered.reduce((acc, api) => {
      const environment = api.environment || 'unknown';
      acc[environment] = (acc[environment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Region distribution
    const regionDistribution = filtered.reduce((acc, api) => {
      const apiRegion = api.region || 'unknown';
      acc[apiRegion] = (acc[apiRegion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Response time trends (mock data for demo)
    const responseTimeTrends = [
      { time: '00:00', responseTime: 120 },
      { time: '04:00', responseTime: 98 },
      { time: '08:00', responseTime: 156 },
      { time: '12:00', responseTime: 134 },
      { time: '16:00', responseTime: 142 },
      { time: '20:00', responseTime: 118 },
    ];

    // Calculate uptime percentage
    const uptimePercent = filtered.length > 0 ? Math.round((onlineApis.length / filtered.length) * 100) : 0;

    return {
      ...metrics,
      avgResponseTime: Math.round(avgResponseTime),
      onlineCount: onlineApis.length,
      offlineCount: offlineApis.length,
      uptimePercent,
      compliancePercent: complianceScore, // Use the calculated compliance score
      envDistribution: Object.entries(envDistribution).map(([name, value]) => ({ name, value })),
      regionDistribution: Object.entries(regionDistribution).map(([name, value]) => ({ name, value })),
      responseTimeTrends
    };
  }, [filtered, metrics, complianceScore]);

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        {/* Header Section */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
                  <Activity className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    API Monitoring Dashboard
                  </h1>
                  <p className="text-gray-600 text-sm">Real-time insights into your API ecosystem</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                  <Clock className="h-4 w-4" />
                  <span>Last updated: {new Date(state.lastUpdated).toLocaleTimeString()}</span>
                </div>
                <button
                    onClick={reload}
                    disabled={state.loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                  <span className="font-medium">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Advanced Filters */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Settings className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Smart Filters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Project</label>
                <select
                    className="w-full bg-white/80 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
                    value={projectId as any}
                    onChange={e => setProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">🌐 All Projects</option>
                  {state.projects.map((p: any) => (
                      <option key={p.id} value={p.id}>📁 {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Environment</label>
                <select
                    className="w-full bg-white/80 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
                    value={env}
                    onChange={e => setEnv(e.target.value as any)}
                >
                  <option value="all">🌍 All Environments</option>
                  <option value="dev">🔧 Development</option>
                  <option value="staging">🧪 Staging</option>
                  <option value="prod">🚀 Production</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Region</label>
                <select
                    className="w-full bg-white/80 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
                    value={region}
                    onChange={e => setRegion(e.target.value as any)}
                >
                  <option value="all">🗺️ All Regions</option>
                  <option value="paris-1">🇫🇷 Paris 1</option>
                  <option value="paris-2">🇫🇷 Paris 2</option>
                  <option value="north-1">🇪🇺 North 1</option>
                </select>
              </div>

              <div className="flex items-end">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3 w-full">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Live Filtering</span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">Updates in real-time</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
                title="Total APIs"
                value={filtered.length || 0}
                icon={<Server className="h-6 w-6" />}
                gradient="from-blue-500 to-blue-600"
                trend="+12% from last week"
                trendUp={true}
            />
            <MetricCard
                title="System Uptime"
                value={`${enhancedMetrics.uptimePercent || 0}%`}
                icon={<CheckCircle className="h-6 w-6" />}
                gradient="from-green-500 to-emerald-600"
                trend="99.9% SLA target"
                trendUp={true}
            />
            <MetricCard
                title="Avg Response"
                value={`${enhancedMetrics.avgResponseTime || 0}ms`}
                icon={<Zap className="h-6 w-6" />}
                gradient="from-purple-500 to-purple-600"
                trend="-5ms from yesterday"
                trendUp={true}
            />
            <MetricCard
                title="Compliance"
                value={`${enhancedMetrics.compliancePercent || 0}%`}
                icon={<Shield className="h-6 w-6" />}
                gradient={(enhancedMetrics.compliancePercent || 0) >= 90 ? "from-green-500 to-emerald-600" : "from-red-500 to-red-600"}
                trend="Version compliance"
                trendUp={(enhancedMetrics.compliancePercent || 0) >= 90}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Response Time Trends */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Response Time Trends</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>Last 24 hours</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={enhancedMetrics.responseTimeTrends}>
                  <defs>
                    <linearGradient id="responseTimeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="time" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                      }}
                  />
                  <Area
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      fill="url(#responseTimeGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Environment Distribution */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Environment Distribution</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Globe className="h-4 w-4" />
                  <span>Active APIs</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                      data={enhancedMetrics.envDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                  >
                    {enhancedMetrics.envDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                      }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Overview */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 flex items-center space-x-3">
              <Activity className="h-6 w-6 text-blue-600" />
              <span>System Health Overview</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StatusCard
                  title="Online APIs"
                  value={enhancedMetrics.onlineCount}
                  icon={<CheckCircle className="h-12 w-12" />}
                  color="green"
                  description="Services running smoothly"
              />

              <StatusCard
                  title="Offline APIs"
                  value={enhancedMetrics.offlineCount}
                  icon={<AlertTriangle className="h-12 w-12" />}
                  color="red"
                  description="Services requiring attention"
              />

              <StatusCard
                  title="Total Projects"
                  value={state.projects.length}
                  icon={<Globe className="h-12 w-12" />}
                  color="blue"
                  description="Active project portfolios"
              />
            </div>
          </div>

          {/* Region Performance */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Regional Performance</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Globe className="h-4 w-4" />
                <span>API Distribution</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={enhancedMetrics.regionDistribution}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
  );
}

// MetricCard Component
function MetricCard({ title, value, icon, gradient, trend, trendUp }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
            <div className={`flex items-center space-x-1 text-xs ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`h-3 w-3 ${trendUp ? '' : 'rotate-180'}`} />
              <span>{trend}</span>
            </div>
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-r ${gradient} text-white shadow-lg`}>
            {icon}
          </div>
        </div>
      </div>
  );
}

// StatusCard Component
function StatusCard({ title, value, icon, color, description }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'green' | 'red' | 'blue';
  description: string;
}) {
  const colorClasses = {
    green: 'text-green-600 bg-green-50 border-green-200',
    red: 'text-red-600 bg-red-50 border-red-200',
    blue: 'text-blue-600 bg-blue-50 border-blue-200'
  };

  return (
      <div className={`rounded-2xl border-2 p-6 ${colorClasses[color]} transition-all duration-300 hover:shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${color === 'green' ? 'bg-green-100' : color === 'red' ? 'bg-red-100' : 'bg-blue-100'}`}>
            {icon}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm font-medium">{title}</p>
          </div>
        </div>
        <p className="text-sm opacity-80">{description}</p>
      </div>
  );
}
