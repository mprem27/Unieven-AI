package com.unieven.auth_service.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HomeController {

    @GetMapping("/")
    public ResponseEntity<?> home() {
        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message", "UniEven Spring Boot Service Running"
                )
        );
    }

    @GetMapping("/error")
    public ResponseEntity<?> error() {
        return ResponseEntity.status(404).body(
                Map.of(
                        "success", false,
                        "message", "Invalid route"
                )
        );
    }
}