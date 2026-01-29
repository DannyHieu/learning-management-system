package com.example.back_end;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

@Component
public class DatabaseInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final ResourceLoader resourceLoader;

    public DatabaseInitializer(JdbcTemplate jdbcTemplate, ResourceLoader resourceLoader) {
        this.jdbcTemplate = jdbcTemplate;
        this.resourceLoader = resourceLoader;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String[] files = {
                "classpath:sql/MSSQL/STORED_PROCEDURES.sql",
                "classpath:sql/MSSQL/TRIGGERS.sql",
                "classpath:sql/MSSQL/FUNCTIONS.sql",
                "classpath:sql/MSSQL/CURSORS.sql"
        };

        System.out.println("Starting SQL Initialization...");

        for (String filePath : files) {
            try {
                Resource resource = resourceLoader.getResource(filePath);
                if (!resource.exists()) {
                    System.err.println("File not found: " + filePath);
                    continue;
                }
                String content = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
                executeSqlScript(content);
                System.out.println("Successfully executed: " + filePath);
            } catch (Exception e) {
                System.err.println("Error executing " + filePath + ": " + e.getMessage());
            }
        }
        System.out.println("SQL Initialization completed.");
    }

    private void executeSqlScript(String script) {
        // Split by GO statement (case insensitive, usually on its own line)
        // This handles standard MSSQL batch splitting which is not supported by
        // standard JDBC
        String[] statements = Pattern.compile("^\\s*GO\\s*$", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE)
                .split(script);

        for (String statement : statements) {
            String trimmed = statement.trim();
            // Skip comments only blocks, empty strings, and USE database statements as
            // connection is already set
            if (!trimmed.isEmpty() && !trimmed.toUpperCase().startsWith("USE ")) {
                try {
                    jdbcTemplate.execute(trimmed);
                } catch (Exception e) {
                    // Log the error but continue with other statements
                    System.err.println("Error in SQL block: " + e.getMessage());
                    // Optionally log a snippet: trimmed.substring(0, Math.min(trimmed.length(),
                    // 100))
                }
            }
        }
    }
}
