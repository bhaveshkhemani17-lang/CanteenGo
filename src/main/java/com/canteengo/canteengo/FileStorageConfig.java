
package com.canteengo.canteengo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class FileStorageConfig implements WebMvcConfigurer {

    @Value("${canteengo.upload-dir:uploads/food}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path imageDirectory = Paths.get(uploadDir)
                .toAbsolutePath()
                .normalize();

        registry.addResourceHandler("/uploads/food/**")
                .addResourceLocations(imageDirectory.toUri().toString());
    }
}

