package com.canteengo.canteengo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminStatsController {

    private final OrderRepository orderRepository;

    public AdminStatsController(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        List<Order> orders = orderRepository.findAll();

        long totalOrders = orders.size();

        long pendingOrders = orders.stream()
                .filter(order -> order.getOrderStatus() != null
                        && (order.getOrderStatus() == OrderStatus.PLACED
                        || order.getOrderStatus() == OrderStatus.CONFIRMED))
                .count();

        BigDecimal completedSales = orders.stream()
                .filter(order -> order.getOrderStatus() == OrderStatus.COMPLETED)
                .map(Order::getTotalAmount)
                .filter(amount -> amount != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalOrders", totalOrders);
        stats.put("pendingOrders", pendingOrders);
        stats.put("completedSales", completedSales);

        return stats;
    }
}