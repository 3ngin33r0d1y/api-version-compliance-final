package com.example.monitoring.controller;

import com.example.monitoring.repo.ProjectRepository;
import com.example.monitoring.model.Entities.Api;
import com.example.monitoring.model.Entities.Project;
import com.example.monitoring.service.MonitoringService;
import com.example.monitoring.service.VersionHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/data" )
public class DataController {

    private final ProjectRepository repo;
    private final MonitoringService monitoring;
    private final VersionHistoryService versionHistory;

    public DataController(ProjectRepository repo, MonitoringService monitoring, VersionHistoryService versionHistory) {
        this.repo = repo;
        this.monitoring = monitoring;
        this.versionHistory = versionHistory;
    }

    // ---------- DTOs ----------
    public record CreateProjectRequest(String name) {}
    public record AddApiRequest(String url, String environment, String region) {}
    public record UpdateApiRequest(String url, String environment, String region) {}

    // ---------- READ ----------
    @GetMapping("/projects")
    public ResponseEntity<?> getProjects() {
        List<Project> projects = repo.findAllProjects();
        List<Api> apis = repo.findAllApis();

        // Group APIs by project
        Map<Long, List<Api>> byProject = new HashMap<>();
        for (Api a : apis) {
            byProject.computeIfAbsent(a.projectId(), k -> new ArrayList<>()).add(a);
        }

        // Build response
        List<Map<String, Object>> out = new ArrayList<>();
        for (Project p : projects) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.id());
            row.put("name", p.name());
            row.put("createdAt", p.createdAt());
            row.put("apis", byProject.getOrDefault(p.id(), List.of())); // always an array
            out.add(row);
        }

        // Probe metadata for each API (service/version). Keep fast with 3s timeout inside service.
        Map<Long, Map<String, String>> metaById = new HashMap<>();
        for (Api a : apis) {
            Map<String, String> meta = monitoring.fetchServiceInfo(a.url());
            metaById.put(a.id(), meta);

            // Update version history if we got version info
            if (!meta.isEmpty() && meta.containsKey("version")) {
                String version = meta.get("version");
                String serviceName = meta.getOrDefault("service", versionHistory.extractServiceFromUrl(a.url()));

                // Update version history with smart detection
                versionHistory.updateApiVersion(
                        a.id(), version, a.environment(), a.region(),
                        a.status(), a.responseTime(), serviceName, a.url(), a.projectId()
                );
            }
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("projects", out);
        payload.put("apis", apis);
        payload.put("allApis", apis);
        payload.put("apisMeta", metaById); // <-- used by All APIs tab to render one-line-per-service
        payload.put("fetchedAt", Instant.now());
        return ResponseEntity.ok(payload);
    }

    // ---------- CREATE PROJECT ----------
    @PostMapping("/projects")
    public ResponseEntity<?> createProject(@RequestBody CreateProjectRequest body) {
        if (body == null || body.name() == null || body.name().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Project name is required"));
        }
        long id = repo.createProject(body.name().trim());
        return ResponseEntity.ok(Map.of("id", id, "name", body.name().trim()));
    }

    // ---------- DELETE PROJECT ----------
    @DeleteMapping("/projects/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable("id") Long id) {
        int rows = repo.deleteProject(id);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    // ---------- ADD API TO PROJECT ----------
    @PostMapping("/projects/{id}/apis")
    public ResponseEntity<?> addApi(@PathVariable("id") Long projectId,
                                    @RequestBody AddApiRequest body) {
        if (body == null || body.url() == null || body.url().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "API url is required"));
        }
        String env = (body.environment() == null || body.environment().isBlank()) ? "dev" : body.environment().trim();
        String region = (body.region() == null || body.region().isBlank()) ? "paris-1" : body.region().trim();

        long apiId = repo.addApi(projectId, body.url().trim(), env, region);

        // Perform a first check & meta probe to warm data
        monitoring.checkAndUpdate(apiId, body.url().trim());
        Map<String, String> meta = monitoring.fetchServiceInfo(body.url().trim());

        // Create initial version history entry
        if (!meta.isEmpty() && meta.containsKey("version")) {
            String version = meta.get("version");
            String serviceName = meta.getOrDefault("service", versionHistory.extractServiceFromUrl(body.url().trim()));

            // Get the API to get its current status
            Api api = repo.getApiById(apiId);
            if (api != null) {
                versionHistory.updateApiVersion(
                        apiId, version, env, region,
                        api.status(), api.responseTime(), serviceName, body.url().trim(), projectId
                );
            }
        }

        return ResponseEntity.ok(Map.of(
                "id", apiId,
                "projectId", projectId,
                "url", body.url().trim(),
                "environment", env,
                "region", region,
                "status", "unknown",
                "meta", meta
        ));
    }

    // ---------- UPDATE API ----------
    @PutMapping("/apis/{id}")
    public ResponseEntity<?> updateApi(@PathVariable("id") Long apiId,
                                       @RequestBody UpdateApiRequest body) {
        if (body == null || body.url() == null || body.url().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "API url is required"));
        }
        String env = (body.environment() == null || body.environment().isBlank()) ? "dev" : body.environment().trim();
        String region = (body.region() == null || body.region().isBlank()) ? "paris-1" : body.region().trim();

        int rows = repo.updateApi(apiId, body.url().trim(), env, region);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }

        // Perform a check & meta probe to refresh data
        monitoring.checkAndUpdate(apiId, body.url().trim());
        Map<String, String> meta = monitoring.fetchServiceInfo(body.url().trim());

        // Update version history
        if (!meta.isEmpty() && meta.containsKey("version")) {
            String version = meta.get("version");
            String serviceName = meta.getOrDefault("service", versionHistory.extractServiceFromUrl(body.url().trim()));

            // Get the API to get its project ID and current status
            Api api = repo.getApiById(apiId);
            if (api != null) {
                versionHistory.updateApiVersion(
                        apiId, version, env, region,
                        api.status(), api.responseTime(), serviceName, body.url().trim(), api.projectId()
                );
            }
        }

        return ResponseEntity.ok(Map.of(
                "id", apiId,
                "url", body.url().trim(),
                "environment", env,
                "region", region,
                "meta", meta
        ));
    }

    // ---------- DELETE API ----------
    @DeleteMapping("/apis/{id}")
    public ResponseEntity<?> deleteApi(@PathVariable("id") Long apiId) {
        int rows = repo.deleteApi(apiId);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    // ---------- VERSION HISTORY ENDPOINTS ----------

    /**
     * Get version history for an API
     */
    @GetMapping("/apis/{apiId}/version-history")
    public ResponseEntity<?> getVersionHistory(
            @PathVariable Long apiId,
            @RequestParam(required = false) String environment) {

        try {
            List<VersionHistoryService.VersionHistory> history = versionHistory.getVersionHistory(apiId, environment);

            // Convert to maps for JSON response
            List<Map<String, Object>> response = new ArrayList<>();
            for (VersionHistoryService.VersionHistory vh : history) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", vh.id());
                item.put("api_id", vh.apiId());
                item.put("version", vh.version());
                item.put("environment", vh.environment());
                item.put("region", vh.region());
                item.put("status", vh.status());
                item.put("response_time", vh.responseTime());
                item.put("detected_at", vh.detectedAt());
                item.put("service_name", vh.serviceName());
                item.put("url", vh.url());
                item.put("project_id", vh.projectId());
                item.put("previous_version", vh.previousVersion());
                item.put("version_change_type", vh.versionChangeType());
                item.put("is_active", vh.isActive());
                response.add(item);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error fetching version history: " + e.getMessage());
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    /**
     * Get version analytics for an API
     */
    @GetMapping("/apis/{apiId}/version-analytics")
    public ResponseEntity<?> getVersionAnalytics(@PathVariable Long apiId) {
        try {
            Map<String, String> latestVersions = versionHistory.getLatestVersionsByEnvironment(apiId);
            Map<String, Object> stats = versionHistory.getVersionChangeStats(apiId, null);

            Map<String, Object> analytics = new HashMap<>();
            analytics.put("latestVersionsByEnvironment", latestVersions);
            analytics.put("changeStats", stats);
            analytics.put("apiId", apiId);
            analytics.put("timestamp", Instant.now());

            return ResponseEntity.ok(analytics);
        } catch (Exception e) {
            System.err.println("Error fetching version analytics: " + e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to fetch analytics: " + e.getMessage());
            return ResponseEntity.ok(error);
        }
    }
}
