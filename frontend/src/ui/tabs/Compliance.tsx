import React, { useState, useEffect } from "react";
import {
    AlertTriangle, CheckCircle, RefreshCw, Shield, AlertCircle, Server,
} from "lucide-react";
import { useData } from "../useData";
import { ApiResponse, ServiceViolation, checkServiceCompliance, normalizeEnvironment } from "../../lib/compliance";

type ComplianceResult = {
    services: Record<string, Record<string, ApiResponse>>;
    violations: ServiceViolation[];
    totalViolations: number;
    criticalViolations: number;
    warningViolations: number;
    compliantServices: number;
    totalServices: number;
    complianceScore: number;
    timestamp: string;
};

export default function Compliance() {
    const { state } = useData(true);
    const [complianceData, setComplianceData] = useState<ComplianceResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // ---- helpers --------------------------------------------------------------
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

    // ---- core checker ---------------------------------------------------------
    const checkCompliance = async () => {
        setLoading(true);
        setError(null);

        try {
            // group by service+project
            const serviceGroups: Record<string, Record<string, ApiResponse>> = {};
            const apis = state.apis ?? [];

            // fetch everything in parallel (faster + resilient)
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
                        responseTime: response ? Math.floor(Math.random() * 200) + 50 : 0, // placeholder
                        projectId: apiItem.projectId,
                        projectName,
                    };
                })
            );

            // if *every* fetch failed catastrophically, surface one error
            const allRejected = results.every((r) => r.status === "rejected");
            if (apis.length > 0 && allRejected) {
                throw new Error("All API checks failed (network/CORS/timeout).");
            }

            // run compliance per grouped service against the fixed rules (A & B)
            const violations: ServiceViolation[] = [];
            for (const [, envs] of Object.entries(serviceGroups)) {
                violations.push(...checkServiceCompliance(envs));
            }

            // metrics
            const totalServices = Object.keys(serviceGroups).length;
            const servicesWithViolations = new Set(violations.map((v) => `${v.service}-${v.projectName}`)).size;
            const compliantServices = Math.max(totalServices - servicesWithViolations, 0);
            const criticalViolations = violations.filter((v) => v.severity === "critical").length;
            const warningViolations = violations.filter((v) => v.severity === "warning").length;
            const complianceScore =
                totalServices > 0 ? Math.round((compliantServices / totalServices) * 100) : 100;

            setComplianceData({
                services: serviceGroups,
                violations,
                totalViolations: violations.length,
                criticalViolations,
                warningViolations,
                compliantServices,
                totalServices,
                complianceScore,
                timestamp: new Date().toISOString(),
            });
            setLastUpdated(new Date());
        } catch (err: any) {
            setError(err?.message || "Failed to check compliance");
        } finally {
            setLoading(false);
        }
    };

    // ---- effects --------------------------------------------------------------
    useEffect(() => {
        if (state.apis.length > 0) {
            checkCompliance();
        } else {
            setLoading(false);
            setComplianceData(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.apis]);

    useEffect(() => {
        if (!autoRefresh || state.apis.length === 0) return;
        const id = setInterval(checkCompliance, 30000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh, state.apis]);

    // ---- UI helpers -----------------------------------------------------------
    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "critical":
                return <AlertCircle className="h-5 w-5 text-red-600" />;
            case "warning":
                return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
            default:
                return <CheckCircle className="h-5 w-5 text-blue-600" />;
        }
    };

    const getEnvironmentColor = (env: string) => {
        switch (env) {
            case "prod":
                return "bg-red-500 text-white";
            case "oat":
                return "bg-orange-500 text-white";
            case "uat":
                return "bg-yellow-500 text-white";
            case "dev":
                return "bg-green-500 text-white";
            default:
                return "bg-gray-500 text-white";
        }
    };

    // ---- render ---------------------------------------------------------------
    if (state.apis.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl">
                                <Shield className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                                    Compliance Monitoring
                                </h1>
                                <p className="text-gray-600 text-sm">Version compliance validation across environments</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                        <Server className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No APIs to Monitor</h3>
                        <p className="text-gray-600">Add some APIs to your projects to start monitoring compliance</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl">
                                <Shield className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                                    Compliance Monitoring
                                </h1>
                                <p className="text-gray-600 text-sm">Version compliance validation across environments</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                <span>{lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : "Never updated"}</span>
                            </div>
                            <button
                                onClick={checkCompliance}
                                disabled={loading}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl hover:from-red-700 hover:to-orange-700 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                <span className="font-medium">Check Compliance</span>
                            </button>
                            <label className="ml-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="mr-2 align-middle"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                />
                                Auto-refresh
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rules banner */}
            <div className="max-w-7xl mx-auto px-6 pt-6">
                <div className="bg-white/80 border border-gray-200 rounded-xl p-4 text-sm text-gray-800">
                    <div className="font-semibold mb-1">Compliance rules:</div>
                    <ul className="list-disc ml-6">
                        <li><span className="font-medium">Rule A:</span> PROD version can’t be higher than OAT or UAT.</li>
                        <li><span className="font-medium">Rule B:</span> OAT version can’t be higher than UAT.</li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
                {/* Compliance Summary */}
                {complianceData && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <SummaryCard title="Compliance Score" value={`${complianceData.complianceScore}%`} icon={<Shield className="h-6 w-6" />} color="blue" />
                        <SummaryCard title="Total Services" value={complianceData.totalServices} icon={<Server className="h-6 w-6" />} color="indigo" />
                        <SummaryCard title="Compliant Services" value={complianceData.compliantServices} icon={<CheckCircle className="h-6 w-6" />} color="green" />
                        <SummaryCard title="Total Violations" value={complianceData.totalViolations} icon={<AlertTriangle className="h-6 w-6" />} color="red" />
                    </div>
                )}

                {/* Violations Table */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20">
                    <div className="p-6 border-b border-gray-200/50">
                        <h3 className="text-lg font-semibold text-gray-900">Compliance Violations</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200/50">
                            <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Violation</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Environments</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12">
                                        <RefreshCw className="h-8 w-8 text-gray-400 mx-auto animate-spin" />
                                        <p className="text-gray-600 mt-2">Checking compliance...</p>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12">
                                        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                                        <p className="text-red-600 mt-2">{error}</p>
                                    </td>
                                </tr>
                            ) : complianceData?.violations.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12">
                                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                                        <p className="text-green-700 font-semibold mt-2">All services are compliant!</p>
                                    </td>
                                </tr>
                            ) : (
                                complianceData?.violations.map((v, idx) => (
                                    <tr key={idx} className={v.severity === "critical" ? "bg-red-50/50" : "bg-yellow-50/50"}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                {getSeverityIcon(v.severity)}
                                                <span className="font-medium text-gray-900">{v.service}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{v.projectName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-800">{v.violation}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex space-x-2">
                                                {Object.entries(v.environments).map(
                                                    ([env, version]) =>
                                                        version && (
                                                            <div key={env} className={`px-2 py-1 text-xs font-bold rounded-full ${getEnvironmentColor(env)}`}>
                                                                {env.toUpperCase()}: {version}
                                                            </div>
                                                        )
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface SummaryCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}

function SummaryCard({ title, value, icon, color }: SummaryCardProps) {
    const gradient =
        {
            blue: "from-blue-500 to-indigo-600",
            indigo: "from-indigo-500 to-purple-600",
            green: "from-green-500 to-emerald-600",
            red: "from-red-500 to-orange-600",
        }[color] || "from-gray-500 to-gray-600";

    return (
        <div className={`bg-gradient-to-br ${gradient} text-white rounded-2xl shadow-lg p-6`}>
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium opacity-80">{title}</p>
                    <p className="text-3xl font-bold">{value}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-full">{icon}</div>
            </div>
        </div>
    );
}
