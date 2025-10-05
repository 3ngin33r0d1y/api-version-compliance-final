export type ApiResponse = {
    service: string;
    version: string;
    url: string;
    status: string;
    environment: string;
    region: string;
    responseTime?: number;
    projectId?: number;
    projectName?: string;
};

export type ServiceViolation = {
    service: string;
    projectName: string;
    violation: string;
    severity: 'critical' | 'warning' | 'info';
    environments: {
        dev?: string;
        uat?: string;
        oat?: string;
        prod?: string;
    };
};

export const normalizeEnvironment = (env: string): string => {
    const normalized = env.toLowerCase();
    if (normalized.includes('prod')) return 'prod';
    if (normalized.includes('oat')) return 'oat';
    if (normalized.includes('uat')) return 'uat';
    if (normalized.includes('dev')) return 'dev';
    return normalized;
};

// Slightly more tolerant compare (handles "v1.2.3" or "1.2.3-beta")
export const compareVersions = (version1: string, version2: string): number => {
    const toParts = (v: string) =>
        v.replace(/^v/i, '')
            .split(/[.-]/)
            .map(s => parseInt(s.replace(/\D+/g, ''), 10) || 0);

    const v1 = toParts(version1);
    const v2 = toParts(version2);
    const len = Math.max(v1.length, v2.length);

    for (let i = 0; i < len; i++) {
        const a = v1[i] ?? 0;
        const b = v2[i] ?? 0;
        if (a !== b) return a - b; // >0 => v1>v2
    }
    return 0;
};

/**
 * Rules:
 * A) PROD version can’t be higher than OAT or UAT  -> critical
 * B) OAT  version can’t be higher than UAT        -> warning
 */
export const checkServiceCompliance = (environments: Record<string, ApiResponse>): ServiceViolation[] => {
    const violations: ServiceViolation[] = [];
    const { dev, uat, oat, prod } = environments;

    if (!dev && !uat && !oat && !prod) return violations;

    const source = dev ?? uat ?? oat ?? prod;
    const serviceName = source?.service ?? 'unknown';
    const projectName = source?.projectName ?? 'Unknown Project';

    const envVersions = {
        dev: dev?.version,
        uat: uat?.version,
        oat: oat?.version,
        prod: prod?.version,
    };

    // Rule A: PROD must NOT be ahead of OAT
    if (prod?.version && oat?.version && compareVersions(prod.version, oat.version) > 0) {
        violations.push({
            service: serviceName,
            projectName,
            violation: `CRITICAL: PROD version (${prod.version}) is higher than OAT version (${oat.version}). PROD version can’t be higher than OAT or UAT.`,
            severity: 'critical',
            environments: envVersions,
        });
    }

    // Rule A: PROD must NOT be ahead of UAT
    if (prod?.version && uat?.version && compareVersions(prod.version, uat.version) > 0) {
        violations.push({
            service: serviceName,
            projectName,
            violation: `CRITICAL: PROD version (${prod.version}) is higher than UAT version (${uat.version}). PROD version can’t be higher than OAT or UAT.`,
            severity: 'critical',
            environments: envVersions,
        });
    }

    // Rule B: OAT must NOT be ahead of UAT
    if (oat?.version && uat?.version && compareVersions(oat.version, uat.version) > 0) {
        violations.push({
            service: serviceName,
            projectName,
            violation: `WARNING: OAT version (${oat.version}) is higher than UAT version (${uat.version}). OAT version can’t be higher than UAT.`,
            severity: 'warning',
            environments: envVersions,
        });
    }

    // Optional sanity: PROD exists but UAT missing
    if (prod?.version && !uat?.version) {
        violations.push({
            service: serviceName,
            projectName,
            violation: `WARNING: PROD exists (${prod.version}) but UAT environment is missing.`,
            severity: 'warning',
            environments: envVersions,
        });
    }

    return violations;
};
