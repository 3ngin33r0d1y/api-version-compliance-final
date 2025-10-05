import React, { useState, useEffect } from 'react';
import { Clock, GitBranch, TrendingUp, AlertCircle, X } from 'lucide-react';

export default function VersionHistoryModal({ apiId, isOpen, onClose }) {
    const [versionHistory, setVersionHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && apiId) {
            fetchVersionHistory();
        }
    }, [isOpen, apiId]);

    const fetchVersionHistory = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/data/apis/${apiId}/version-history`);
            const data = await response.json();
            setVersionHistory(data);
        } catch (error) {
            console.error('Error fetching version history:', error);
        } finally {
            setLoading(false);
        }
    };

    const getChangeTypeIcon = (changeType) => {
        switch (changeType) {
            case 'major': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'minor': return <TrendingUp className="h-4 w-4 text-yellow-500" />;
            case 'patch': return <GitBranch className="h-4 w-4 text-green-500" />;
            case 'initial': return <Clock className="h-4 w-4 text-blue-500" />;
            default: return <Clock className="h-4 w-4 text-gray-500" />;
        }
    };

    const getChangeTypeBadge = (changeType) => {
        const colors = {
            major: 'bg-red-100 text-red-800',
            minor: 'bg-yellow-100 text-yellow-800',
            patch: 'bg-green-100 text-green-800',
            initial: 'bg-blue-100 text-blue-800',
            unknown: 'bg-gray-100 text-gray-800'
        };
        return colors[changeType] || colors.unknown;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                            <Clock className="h-5 w-5" />
                            <span>Version History</span>
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-gray-600 mt-2">Loading version history...</p>
                        </div>
                    ) : versionHistory.length === 0 ? (
                        <div className="text-center py-8">
                            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No version history available</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {versionHistory.map((entry, index) => (
                                <div key={entry.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                    <div className="flex-shrink-0">
                                        {getChangeTypeIcon(entry.version_change_type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="font-semibold text-gray-900 text-lg">{entry.version}</span>
                                            <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                                {entry.environment}
                                            </span>
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getChangeTypeBadge(entry.version_change_type)}`}>
                                                {entry.version_change_type}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {entry.previous_version && (
                                                <span className="mr-2">
                                                    <span className="text-gray-400">From:</span> {entry.previous_version} →
                                                </span>
                                            )}
                                            <span className="text-gray-500">
                                                {new Date(entry.detected_at).toLocaleString()}
                                            </span>
                                        </div>
                                        {entry.service_name && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                Service: {entry.service_name}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className={`px-2 py-1 text-xs rounded-full font-medium ${
                                            entry.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {entry.status}
                                        </div>
                                        {entry.response_time && (
                                            <div className="text-xs text-gray-500 mt-1">{entry.response_time}ms</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
