package com.example.monitoring.service;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class VersionHistoryService {

    private final JdbcTemplate jdbc;

    public VersionHistoryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record VersionHistory(
            Long id, Long apiId, String version, String environment, String region,
            String status, Integer responseTime, Instant detectedAt, String serviceName,
            String url, Long projectId, String previousVersion, String versionChangeType,
            Boolean isActive
    ) {}

    private static class VersionHistoryRow implements RowMapper<VersionHistory> {
        @Override
        public VersionHistory mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new VersionHistory(
                    rs.getLong("id"),
                    rs.getLong("api_id"),
                    rs.getString("version"),
                    rs.getString("environment"),
                    rs.getString("region"),
                    rs.getString("status"),
                    (Integer) rs.getObject("response_time"),
                    rs.getTimestamp("detected_at").toInstant(),
                    rs.getString("service_name"),
                    rs.getString("url"),
                    rs.getLong("project_id"),
                    rs.getString("previous_version"),
                    rs.getString("version_change_type"),
                    rs.getBoolean("is_active")
            );
        }
    }

    public void updateApiVersion(Long apiId, String newVersion, String environment,
                                 String region, String status, Integer responseTime,
                                 String serviceName, String url, Long projectId) {

        String currentVersion = getCurrentVersion(apiId);

        if (currentVersion == null || !currentVersion.equals(newVersion)) {
            String changeType = determineChangeType(currentVersion, newVersion);
            createVersionHistoryEntry(apiId, newVersion, environment, region, status,
                    responseTime, serviceName, url, projectId,
                    currentVersion, changeType);
            updateCurrentVersion(apiId, newVersion);
            logVersionChange(apiId, currentVersion, newVersion, environment, changeType);
        } else {
            updateApiStatus(apiId, status, responseTime);
        }
    }

    private String getCurrentVersion(Long apiId) {
        try {
            return jdbc.queryForObject(
                    "SELECT current_version FROM apis WHERE id = ?",
                    String.class, apiId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private String determineChangeType(String oldVersion, String newVersion) {
        if (oldVersion == null || oldVersion.equals("0.0.0")) return "initial";

        try {
            String[] oldParts = oldVersion.split("\\.");
            String[] newParts = newVersion.split("\\.");

            if (oldParts.length >= 1 && newParts.length >= 1) {
                int oldMajor = Integer.parseInt(oldParts[0]);
                int newMajor = Integer.parseInt(newParts[0]);
                if (oldMajor != newMajor) return "major";
            }

            if (oldParts.length >= 2 && newParts.length >= 2) {
                int oldMinor = Integer.parseInt(oldParts[1]);
                int newMinor = Integer.parseInt(newParts[1]);
                if (oldMinor != newMinor) return "minor";
            }

            return "patch";
        } catch (Exception e) {
            return "unknown";
        }
    }

    private void createVersionHistoryEntry(Long apiId, String version, String environment,
                                           String region, String status, Integer responseTime,
                                           String serviceName, String url, Long projectId,
                                           String previousVersion, String changeType) {

        String sql = """
            INSERT INTO api_version_history 
            (api_id, version, environment, region, status, response_time, service_name, 
             url, project_id, previous_version, version_change_type, detected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

        jdbc.update(sql, apiId, version, environment, region, status,
                responseTime, serviceName, url, projectId,
                previousVersion, changeType, Timestamp.from(Instant.now()));
    }

    private void updateCurrentVersion(Long apiId, String newVersion) {
        jdbc.update(
                "UPDATE apis SET current_version = ?, updated_at = ? WHERE id = ?",
                newVersion, Timestamp.from(Instant.now()), apiId
        );
    }

    private void updateApiStatus(Long apiId, String status, Integer responseTime) {
        jdbc.update(
                "UPDATE apis SET status = ?, response_time = ?, last_checked = ? WHERE id = ?",
                status, responseTime, Timestamp.from(Instant.now()), apiId
        );
    }

    private void logVersionChange(Long apiId, String oldVersion, String newVersion,
                                  String environment, String changeType) {
        System.out.println(String.format(
                "🔄 Version Change Detected - API ID: %d, Environment: %s, %s → %s (%s)",
                apiId, environment, oldVersion, newVersion, changeType
        ));
    }

    public List<VersionHistory> getVersionHistory(Long apiId, String environment) {
        String sql = """
            SELECT * FROM api_version_history 
            WHERE api_id = ? AND (? IS NULL OR environment = ?)
            ORDER BY detected_at DESC
            """;

        return jdbc.query(sql, new VersionHistoryRow(), apiId, environment, environment);
    }

    public Map<String, String> getLatestVersionsByEnvironment(Long apiId) {
        String sql = """
            SELECT DISTINCT ON (environment) environment, version
            FROM api_version_history 
            WHERE api_id = ? 
            ORDER BY environment, detected_at DESC
            """;

        Map<String, String> versions = new HashMap<>();
        jdbc.query(sql, rs -> {
            versions.put(rs.getString("environment"), rs.getString("version"));
        }, apiId);

        return versions;
    }

    public String extractServiceFromUrl(String url) {
        try {
            return new URL(url).getHost().split("\\.")[0];
        } catch (Exception e) {
            return "unknown-service";
        }
    }

    public Map<String, Object> getVersionChangeStats(Long apiId, String environment) {
        String sql = """
            SELECT 
                COUNT(*) as total_changes,
                COUNT(CASE WHEN version_change_type = 'major' THEN 1 END) as major_changes,
                COUNT(CASE WHEN version_change_type = 'minor' THEN 1 END) as minor_changes,
                COUNT(CASE WHEN version_change_type = 'patch' THEN 1 END) as patch_changes,
                MIN(detected_at) as first_change,
                MAX(detected_at) as last_change
            FROM api_version_history 
            WHERE api_id = ? AND (? IS NULL OR environment = ?)
            """;

        List<Map<String, Object>> results = jdbc.queryForList(sql, apiId, environment, environment);
        return results.isEmpty() ? new HashMap<>() : results.get(0);
    }
}
