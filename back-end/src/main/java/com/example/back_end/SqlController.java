package com.example.back_end;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sql")
@CrossOrigin(origins = "http://localhost:5173")
public class SqlController {

    private final JdbcTemplate jdbcTemplate;

    public SqlController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/execute")
    public List<Map<String, Object>> executeSql(@RequestBody String sql) {
        return jdbcTemplate.queryForList(sql);
    }
}
