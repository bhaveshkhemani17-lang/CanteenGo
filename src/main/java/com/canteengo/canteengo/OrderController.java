
package com.canteengo.canteengo;

import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final FoodItemRepository foodItemRepository;

    public OrderController(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            FoodItemRepository foodItemRepository) {

        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.foodItemRepository = foodItemRepository;
    }

    // GET: Get all orders for the admin dashboard
    @GetMapping
    public List<Order> getOrders() {
        return orderRepository.findAll();
    }
    
    // GET: Get the latest status of one order
    @GetMapping("/{id}/status")
    public StatusResponse getOrderStatus(@PathVariable Long id) {

        Order order = orderRepository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Order not found"));

        return new StatusResponse(
                order.getOrderStatus().name());
    }

    public static class StatusResponse {
        public String status;

        public StatusResponse(String status) {
            this.status = status;
        }
    }

    // POST: Place an order without customer login
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public OrderResponse placeOrder(
            @RequestBody OrderRequest request) {

        if (request == null
                || request.customerName == null
                || request.customerName.isBlank()
                || request.customerName.length() > 100
                || request.items == null
                || request.items.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Customer name and cart items are required");
        }

        BigDecimal total = BigDecimal.ZERO;

        // Validate each item and calculate the total
        // using prices stored in the database
        for (OrderLine line : request.items) {

            if (line == null
                    || line.id == null
                    || line.id <= 0
                    || line.quantity == null
                    || line.quantity < 1
                    || line.quantity > 100) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid food ID or quantity");
            }

            FoodItem food = foodItemRepository.findById(line.id)
                    .orElseThrow(() ->
                            new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    "Food item not found: " + line.id));

            if (!food.isAvailable()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        food.getFoodName()
                                + " is currently unavailable");
            }

            total = total.add(
                    food.getPrice().multiply(
                            BigDecimal.valueOf(line.quantity)));
        }

        // Create and save the order
        Order order = new Order();
        order.setCustomerName(request.customerName.trim());
        order.setTotalAmount(total);

        Order savedOrder = orderRepository.saveAndFlush(order);

        // Save each item associated with this order
        for (OrderLine line : request.items) {

            FoodItem food = foodItemRepository.findById(line.id)
                    .orElseThrow(() ->
                            new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    "Food item not found: " + line.id));

            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(savedOrder);
            orderItem.setFoodItem(food);
            orderItem.setQuantity(line.quantity);
            orderItem.setPrice(food.getPrice());

            orderItemRepository.save(orderItem);
        }

        return new OrderResponse(
                savedOrder.getOrderId(),
                savedOrder.getTotalAmount(),
                savedOrder.getOrderStatus().name());
    }

    // PATCH: Update an order's status
    @PatchMapping("/{id}/status")
    @Transactional
    public Order updateOrderStatus(
            @PathVariable Long id,
            @RequestBody StatusRequest request) {

        if (request == null
                || request.status == null
                || request.status.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order status is required");
        }

        Order order = orderRepository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Order not found"));

        try {
            OrderStatus status = OrderStatus.valueOf(
                    request.status.trim().toUpperCase());

            order.setOrderStatus(status);

            return orderRepository.save(order);

        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid order status");
        }
    }

    // Request received from the frontend
    public static class OrderRequest {
        public String customerName;
        public List<OrderLine> items;
    }

    public static class OrderLine {
        public Long id;
        public Integer quantity;
    }

    // Response sent to the customer frontend
    public static class OrderResponse {
        public Long orderId;
        public BigDecimal totalAmount;
        public String status;

        public OrderResponse(
                Long orderId,
                BigDecimal totalAmount,
                String status) {

            this.orderId = orderId;
            this.totalAmount = totalAmount;
            this.status = status;
        }
    }

    // Request received when the admin changes status
    public static class StatusRequest {
        public String status;
    }
}

