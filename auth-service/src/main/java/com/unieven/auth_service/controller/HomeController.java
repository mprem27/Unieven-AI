package com.unieven.auth_service.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "UniEven Spring Boot Service Running";
    }

    @GetMapping("/error")
    public String error() {
        return "Invalid route";
    }
}