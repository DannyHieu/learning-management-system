package com.example.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sql")
@CrossOrigin(origins = "*") // Allow requests from frontend
public class SqlController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostMapping("/execute")
    public List<Map<String, Object>> executeHelper(@RequestBody String sql) {
        // SECURITY WARNING: This allows arbitrary SQL execution.
        // DO NOT USE IN PRODUCTION.
        // Remove quotes if sent as a JSON string, a rudimentary clean up
        String cleanSql = sql.trim();
        if (cleanSql.startsWith("\"") && cleanSql.endsWith("\"")) {
            cleanSql = cleanSql.substring(1, cleanSql.length() - 1);
        }
        // Basic unescaping for common JSON chars if needed, though usually RequestBody handles it if it's not raw string
        // If content-type is text/plain, 'sql' is just the query.
        
        System.out.println("Executing SQL: " + cleanSql);
        return jdbcTemplate.queryForList(cleanSql);
    }
    
    @ExceptionHandler(Exception.class)
    public Map<String, String> handleException(Exception e) {
        return Map.of("error", e.getMessage());
    }
}
