
package com.canteengo.canteengo;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodItemRepository foodItemRepository;
    private final CategoryRepository categoryRepository;

    public FoodController(
            FoodItemRepository foodItemRepository,
            CategoryRepository categoryRepository) {
        this.foodItemRepository = foodItemRepository;
        this.categoryRepository = categoryRepository;
    }

    @GetMapping
public List<FoodItem> getFoods() {
    return foodItemRepository.findAll()
            .stream()
            .filter(FoodItem::isAvailable)
            .toList();
}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FoodItem addFood(@RequestBody FoodRequest request) {

        if (request.name == null || request.name.isBlank()
                || request.price == null
                || request.price.signum() < 0
                || request.category == null
                || request.category.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Name, valid price, and category are required");
        }

        Category category = categoryRepository
                .findByCategoryNameIgnoreCase(request.category)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Category not found. Add the category first."));

        FoodItem food = new FoodItem();
        food.setFoodName(request.name);
        food.setPrice(request.price);
        food.setCategory(category);
        food.setDescription(request.description);
        food.setImageUrl(request.imageUrl);
        food.setAvailable(true);

        return foodItemRepository.save(food);
    }

   @DeleteMapping("/{id}")
public org.springframework.http.ResponseEntity<?> deleteFood(
        @PathVariable Long id) {

    FoodItem food = foodItemRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Food item not found"));

    food.setAvailable(false);
    foodItemRepository.save(food);

    return org.springframework.http.ResponseEntity.noContent().build();
}

    public static class FoodRequest {
        public String name;
        public BigDecimal price;
        public String category;
        public String description;
        public String imageUrl;
    }
}
