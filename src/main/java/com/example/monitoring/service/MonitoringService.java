package com.example.monitoring.service;

import com.example.monitoring.repo.ProjectRepository;
import com.example.monitoring.model.Entities.Api;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class MonitoringService {

    private final WebClient webClient;
    private final ProjectRepository repo;
    private final VersionHistoryService versionHistory;

    public MonitoringService(ProjectRepository repo, VersionHistoryService versionHistory ) {
        this.repo = repo;
        this.versionHistory = versionHistory;
        this.webClient = WebClient.builder().build();
    }

    public record CheckResult(String status, int responseTimeMs) {}

    public CheckResult checkAndUpdate(Long apiId, String targetUrl) {
        Instant start = Instant.now();
        String status;

        try {
            String responseStatus = webClient.get()
                    .uri(URI.create(targetUrl))
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, r -> Mono.empty())
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(8))
                    .map(e -> e.getStatusCode().is2xxSuccessful() ? "online" : "offline")
                    .blockOptional()
                    .orElse("offline");

            status = responseStatus;
        } catch (Exception e) {
            status = "offline";
        }

        int rt = (int) (Duration.between(start, Instant.now()).toMillis());
        repo.updateApiStatus(apiId, status, rt, Instant.now());

        // Fetch version info and update history
        Map<String, String> meta = fetchServiceInfo(targetUrl);
        if (!meta.isEmpty() && meta.containsKey("version")) {
            String version = meta.get("version");
            String serviceName = meta.getOrDefault("service", versionHistory.extractServiceFromUrl(targetUrl));

            // Get API details for version history
            Api api = repo.getApiById(apiId);
            if (api != null) {
                versionHistory.updateApiVersion(
                        apiId, version, api.environment(), api.region(),
                        status, rt, serviceName, targetUrl, api.projectId()
                );
            }
        }

        return new CheckResult(status, rt);
    }

    /**
     * Fetch lightweight metadata from an API that returns:
     * { "version": "1.0.0", "service": "api-name-invoice-job" }
     * Returns an empty map on failure.
     */
    public Map<String, String> fetchServiceInfo(String url) {
        try {
            Map<?, ?> m = webClient.get()
                    .uri(URI.create(url))
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, r -> Mono.empty())
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(3))
                    .blockOptional()
                    .orElse(null);

            Map<String, String> out = new HashMap<>();
            if (m != null) {
                Object version = m.get("version");
                Object service = m.get("service");
                if (version != null) out.put("version", version.toString());
                if (service != null) out.put("service", service.toString());
            }
            return out;
        } catch (Exception e) {
            return Map.of();
        }
    }

    /**
     * Enhanced service info fetching with fallback endpoints
     */
    public Map<String, String> fetchServiceInfoWithFallback(String baseUrl) {
        String[] endpoints = {
                baseUrl,
                baseUrl + "/version",
                baseUrl + "/health",
                baseUrl + "/info",
                baseUrl + "/actuator/info"
        };

        for (String endpoint : endpoints) {
            Map<String, String> result = fetchServiceInfo(endpoint);
            if (!result.isEmpty()) {
                return result;
            }
        }

        return Map.of();
    }

    /**
     * Batch check multiple APIs
     */
    public Map<Long, CheckResult> batchCheck(Map<Long, String> apiUrls) {
        Map<Long, CheckResult> results = new HashMap<>();

        for (Map.Entry<Long, String> entry : apiUrls.entrySet()) {
            try {
                CheckResult result = checkAndUpdate(entry.getKey(), entry.getValue());
                results.put(entry.getKey(), result);
            } catch (Exception e) {
                results.put(entry.getKey(), new CheckResult("offline", 0));
            }
        }

        return results;
    }

    /**
     * Get API health summary
     */
    public Map<String, Object> getHealthSummary() {
        // This would typically query your database for API status counts
        // For now, returning a placeholder
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalApis", 0);
        summary.put("onlineApis", 0);
        summary.put("offlineApis", 0);
        summary.put("averageResponseTime", 0);
        summary.put("lastUpdated", Instant.now());

        return summary;
    }
}
