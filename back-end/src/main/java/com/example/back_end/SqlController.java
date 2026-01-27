package com.example.back_end;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/sql")
@CrossOrigin(origins = "http://localhost:5173")
public class SqlController {

    private final JdbcTemplate jdbcTemplate;
    private final ImportService importService;

    public SqlController(JdbcTemplate jdbcTemplate, ImportService importService) {
        this.jdbcTemplate = jdbcTemplate;
        this.importService = importService;
    }

    @PostMapping("/execute")
    public List<Map<String, Object>> executeSql(@RequestBody String sql) {
        return jdbcTemplate.queryForList(sql);
    }

    @PostMapping("/import")
    public ResponseEntity<?> importData(@RequestParam("file") MultipartFile file, @RequestParam("type") String type) {
        try {
            Map<String, Object> result = importService.importFile(file, type);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "An error occurred during import: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/export")
    public ResponseEntity<?> exportData(@RequestParam("type") String type) {
        try {
            String csvContent = importService.exportToCSV(type);
            byte[] out = csvContent.getBytes();

            return ResponseEntity.ok()
                    .header("Content-Type", "text/csv")
                    .header("Content-Disposition", "attachment; filename=" + type + "_report.csv")
                    .body(out);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "An error occurred during export: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
