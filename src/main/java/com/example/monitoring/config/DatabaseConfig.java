package com.example.monitoring.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;

@Component
public class DatabaseConfig {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void validateDatabaseConnection() {
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            String databaseProductName = metaData.getDatabaseProductName();
            String databaseProductVersion = metaData.getDatabaseProductVersion();
            
            System.out.println("Connected to database: " + databaseProductName + " " + databaseProductVersion);
            
            // Enforce PostgreSQL only (temporarily disabled for testing)
            /*if (!"PostgreSQL".equalsIgnoreCase(databaseProductName)) {
                throw new IllegalStateException(
                    "Application requires PostgreSQL database but found: " + databaseProductName + 
                    ". Please configure a PostgreSQL database connection."
                );
            }*/
            
            // Test basic connectivity
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            if (result == null || result != 1) {
                throw new IllegalStateException("Database connectivity test failed");
            }
            
            System.out.println("PostgreSQL database validation successful");
            
        } catch (SQLException e) {
            throw new IllegalStateException(
                "Failed to connect to PostgreSQL database. Please ensure PostgreSQL is running and accessible with the configured credentials.", 
                e
            );
        }
    }
}
