"use strict";

/* ============================
   CANTEENGO STUDENT WEBSITE
   Java Spring Boot + MySQL API
============================ */

if (!window.location.pathname.endsWith("admin.html")) {
  let products = [];
  let categories = ["All Items"];

  const storageKeys = {
    cart: "canteengo-cart",
    latestOrder: "canteengo-latest-order",
    sequence: "canteengo-order-sequence"
  };

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage error:", error);
    }
  }

  const state = {
    cart: readStorage(storageKeys.cart, []),
    latestOrder: readStorage(storageKeys.latestOrder, null),
    filter: "All Items",
    search: "",
    previousFocus: null
  };

  const elements = {
    categoryList: document.querySelector("#category-list"),
    productGrid: document.querySelector("#product-grid"),
    search: document.querySelector("#menu-search"),
    clearSearch: document.querySelector('[data-action="clear-search"]'),
    cartCount: document.querySelector("#nav-cart-count"),
    cartTitleCount: document.querySelector("#cart-title-count"),
    cartOverlay: document.querySelector("#cart-overlay"),
    emptyCart: document.querySelector("#empty-cart"),
    cartLines: document.querySelector("#cart-lines"),
    cartSummary: document.querySelector("#cart-summary"),
    cartItemCount: document.querySelector("#cart-item-count"),
    cartSummaryCount: document.querySelector("#cart-summary-count"),
    cartSubtotal: document.querySelector("#cart-subtotal"),
    orderOverlay: document.querySelector("#order-overlay"),
    orderNumber: document.querySelector("#order-number"),
    orderDate: document.querySelector("#order-date"),
    orderItems: document.querySelector("#order-items"),
    orderTotal: document.querySelector("#order-total"),
    latestOrderChip: document.querySelector(".latest-order-chip"),
    latestOrderNumber: document.querySelector("#latest-order-number"),
    liveMessage: document.querySelector("#live-message"),
    mainNavigation: document.querySelector("#main-navigation"),
    mobileMenu: document.querySelector(".mobile-menu-button")
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatPrice(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN")}`;
  }

  function announce(message) {
    if (!elements.liveMessage) return;

    elements.liveMessage.textContent = "";
    window.setTimeout(() => {
      elements.liveMessage.textContent = message;
    }, 20);
  }

  function productFor(id) {
    return products.find(product => String(product.id) === String(id));
  }

  function cartItemCount() {
    return state.cart.reduce((count, item) => count + item.quantity, 0);
  }

  function cartSubtotal() {
    return state.cart.reduce((total, item) => {
      const product = productFor(item.id);
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  }

  /* Load menu items from Java backend */
  async function loadProducts() {
    try {
      const response = await fetch("/api/foods");

      if (!response.ok) {
        throw new Error("Could not load menu items.");
      }

      const foods = await response.json();

      products = foods
        .filter(food => food.isAvailable !== false)
        .map(food => {
          const category = typeof food.category === "object"
            ? food.category?.categoryName
            : food.category;

          return {
            id: String(food.foodId ?? food._id ?? food.id),
            name: food.foodName ?? food.name ?? "Food item",
            description: food.description || "Fresh from the canteen",
            price: Number(food.price || 0),
            rating: String(food.rating || "4.8"),
            category: category || "Other",
            image: food.imageUrl
              ? (food.imageUrl.startsWith("http")
                ? food.imageUrl
                : `http://localhost:8080${food.imageUrl.startsWith("/") ? "" : "/"}${food.imageUrl}`)
              : "images/burger.jpg",
            tag: food.tag || ""
          };
        });

      categories = [
        "All Items",
        ...new Set(products.map(product => product.category))
      ];

      if (!categories.includes(state.filter)) {
        state.filter = "All Items";
      }

      // Remove cart items that no longer exist in the database.
      state.cart = state.cart
        .filter(item => productFor(item.id))
        .map(item => ({
          ...item,
          id: String(item.id),
          quantity: Math.max(1, Number(item.quantity) || 1)
        }));

      writeStorage(storageKeys.cart, state.cart);

      renderCategories();
      renderProducts();
      renderCart();

    } catch (error) {
      console.error("Menu loading error:", error);
      announce(
        "Could not load the menu. Check that Spring Boot and MySQL are running."
      );
    }
  }

  function renderCategories() {
    if (!elements.categoryList) return;

    elements.categoryList.innerHTML = categories.map(category => {
      const selected = category === state.filter;

      return `
        <button
          class="category-button${selected ? " selected" : ""}"
          type="button"
          data-filter="${escapeHtml(category)}"
          aria-pressed="${selected}">
          ${escapeHtml(category)}
        </button>
      `;
    }).join("");
  }

  function renderProducts() {
    if (!elements.productGrid) return;

    const query = state.search.trim().toLowerCase();

    const visibleProducts = products.filter(product => {
      const categoryMatches =
        state.filter === "All Items" || product.category === state.filter;

      const searchMatches =
        !query ||
        `${product.name} ${product.description}`
          .toLowerCase()
          .includes(query);

      return categoryMatches && searchMatches;
    });

    if (visibleProducts.length === 0) {
      elements.productGrid.innerHTML = `
        <div class="empty-results">
          <span class="empty-search" aria-hidden="true">⌕</span>
          <strong>No bites found just yet</strong>
          <p>Try another name or browse all canteen favourites.</p>
          <button class="button button-primary"
                  type="button"
                  data-action="reset-menu">
            Show all items
          </button>
        </div>
      `;
      return;
    }

    elements.productGrid.innerHTML = visibleProducts.map(
      (product, index) => `
        <article class="product-card"
                 style="animation-delay:${Math.min(index * 55, 330)}ms">
          <div class="product-photo-wrap">
            <img class="product-image"
                 src="${escapeHtml(product.image)}"
                 alt="${escapeHtml(product.name)}"
                 loading="lazy">

            ${product.tag
          ? `<span class="product-tag">${escapeHtml(product.tag)}</span>`
          : ""}

            <span class="product-rating">
              <span aria-hidden="true">★</span>
              ${escapeHtml(product.rating)}
            </span>
          </div>

          <div class="product-info">
            <div class="product-title-row">
              <h3>${escapeHtml(product.name)}</h3>
              <span class="price">${formatPrice(product.price)}</span>
            </div>

            <p>${escapeHtml(product.description)}</p>

            <button class="add-button"
                    type="button"
                    data-action="add"
                    data-id="${escapeHtml(product.id)}">
              <span aria-hidden="true">+</span> Add to Cart
            </button>
          </div>
        </article>
      `
    ).join("");
  }

  function renderCart() {
    if (!elements.cartCount) return;

    const count = cartItemCount();
    const subtotal = cartSubtotal();

    elements.cartCount.textContent = String(count);
    elements.cartTitleCount.textContent = `(${count})`;
    elements.cartItemCount.textContent = String(count);
    elements.cartSummaryCount.textContent = `(${count})`;
    elements.cartSubtotal.textContent = formatPrice(subtotal);

    elements.emptyCart.hidden = state.cart.length > 0;
    elements.cartLines.hidden = state.cart.length === 0;
    elements.cartSummary.hidden = state.cart.length === 0;

    elements.cartLines.innerHTML = state.cart.map(item => {
      const product = productFor(item.id);
      if (!product) return "";

      return `
        <article class="cart-line">
          <img src="./${escapeHtml(product.image)}" alt="">

          <div class="cart-line-info">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${formatPrice(product.price)} each</span>

            <div class="quantity-stepper">
              <button type="button"
                      data-action="decrease"
                      data-id="${escapeHtml(product.id)}">−</button>

              <output>${item.quantity}</output>

              <button type="button"
                      data-action="increase"
                      data-id="${escapeHtml(product.id)}">+</button>
            </div>
          </div>

          <div class="cart-line-end">
            <strong>
              ${formatPrice(product.price * item.quantity)}
            </strong>

            <button class="remove-button"
                    type="button"
                    data-action="remove"
                    data-id="${escapeHtml(product.id)}">×</button>
          </div>
        </article>
      `;
    }).join("");

    if (elements.latestOrderChip) {
      elements.latestOrderChip.hidden = !state.latestOrder;
    }

    if (state.latestOrder && elements.latestOrderNumber) {
      elements.latestOrderNumber.textContent = state.latestOrder.number;
    }
  }

  function saveCart() {
    writeStorage(storageKeys.cart, state.cart);
    renderCart();
  }

  function addToCart(id) {
    const product = productFor(id);
    if (!product) return;

    const existing = state.cart.find(
      item => String(item.id) === String(id)
    );

    if (existing) {
      existing.quantity++;
    } else {
      state.cart.push({ id: String(id), quantity: 1 });
    }

    saveCart();
    announce(`${product.name} added to cart.`);
  }

  function changeQuantity(id, change) {
    state.cart = state.cart
      .map(item => String(item.id) === String(id)
        ? { ...item, quantity: item.quantity + change }
        : item)
      .filter(item => item.quantity > 0);

    saveCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter(
      item => String(item.id) !== String(id)
    );

    saveCart();
  }

  function openCart() {
    state.previousFocus = document.activeElement;
    renderCart();
    elements.cartOverlay.hidden = false;
    document.body.classList.add("dialog-open");

    elements.cartOverlay
      .querySelector('[data-action="close-cart"]')
      ?.focus();
  }

  function closeCart() {
    elements.cartOverlay.hidden = true;
    unlockBodyIfNoDialog();
    restoreFocus();
  }

  function openOrder() {
    if (!state.latestOrder) return;

    state.previousFocus = document.activeElement;
    renderOrder();
    elements.orderOverlay.hidden = false;
    document.body.classList.add("dialog-open");

    elements.orderOverlay
      .querySelector('[data-action="close-order"]')
      ?.focus();
  }

  function closeOrder() {
    elements.orderOverlay.hidden = true;
    unlockBodyIfNoDialog();
    restoreFocus();
  }

  function restoreFocus() {
    if (
      state.previousFocus instanceof HTMLElement &&
      state.previousFocus.isConnected
    ) {
      state.previousFocus.focus();
    }

    state.previousFocus = null;
  }

  function unlockBodyIfNoDialog() {
    if (
      elements.cartOverlay.hidden &&
      elements.orderOverlay.hidden
    ) {
      document.body.classList.remove("dialog-open");
    }
  }


  function renderOrder() {
    const order = state.latestOrder;
    if (!order) return;

    elements.orderNumber.textContent = order.number;
    elements.orderDate.textContent = order.date;
    elements.orderTotal.textContent = formatPrice(order.subtotal);

    elements.orderItems.innerHTML = order.items.map(item => `
      <div class="order-item">
        <span>
          ${escapeHtml(item.name)}
          <b>× ${Number(item.quantity)}</b>
        </span>
        <strong>
          ${formatPrice(item.price * item.quantity)}
        </strong>
      </div>
    `).join("");

    // Display the current order status
    const statusElement = document.getElementById("userOrderStatus");

    if (statusElement) {
      const status = (order.status || "Pending").toLowerCase();

      statusElement.textContent =
        status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  // Fetch the latest order status from Spring Boot

  async function refreshUserOrderStatus() {
    const order = state.latestOrder;

    if (!order || !order.databaseId) return;

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.databaseId)}/status`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        console.error(
          "Could not fetch order status:",
          response.status
        );
        return;
      }

      const result = await response.json();

      if (!result.status) return;

      // Convert PREPARING to Preparing
      const rawStatus = result.status.toLowerCase();
      const displayStatus = rawStatus
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // Update saved order
      order.status = result.status;
      writeStorage(storageKeys.latestOrder, order);

      // Update Latest Pickup display
      const statusElement =
        document.getElementById("userOrderStatus");

      if (statusElement) {
        statusElement.textContent = displayStatus;
      }

    } catch (error) {
      console.error("Could not refresh order status:", error);
    }
  }
  refreshUserOrderStatus();
setInterval(refreshUserOrderStatus, 5000);

  /* Submit an order to Spring Boot */
  async function placeOrder() {
    if (state.cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    const nameInput = document.getElementById("customerName");
    const customerName = nameInput?.value.trim();

    if (!customerName) {
      alert("Please enter your name before placing the order.");
      nameInput?.focus();
      return;
    }

    // Java expects numeric food IDs and quantities.
    const items = state.cart.map(item => ({
      id: Number(item.id),
      quantity: Number(item.quantity)
    }));

    if (items.some(item =>
      !Number.isInteger(item.id) ||
      item.id <= 0 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )) {
      alert("Invalid menu item. Refresh the menu and try again.");
      return;
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerName,
          items
        })
      });

      const responseText = await response.text();
      let result = {};

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.message || result.error || "Could not place order."
        );
      }

      let previousSequence = Number(
        localStorage.getItem(storageKeys.sequence) || 1000
      );

      if (!Number.isInteger(previousSequence) || previousSequence < 1000) {
        previousSequence = 1000;
      }

      const sequence = previousSequence + 1;
      writeStorage(storageKeys.sequence, sequence);

      const order = {
        number: `CG-${sequence}`,
        databaseId: result.orderId ?? result._id ?? result.id ?? null,
        customerName,
        status: result.status || "Pending",
        date: new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date()),
        items: state.cart.map(item => {
          const product = productFor(item.id);

          return {
            id: Number(item.id),
            name: product?.name || "Menu item",
            price: product?.price || 0,
            quantity: item.quantity
          };
        }),
        subtotal: Number(
          result.total ?? result.totalAmount ?? cartSubtotal()
        )
      };

      state.latestOrder = order;
      writeStorage(storageKeys.latestOrder, order);

      state.cart = [];
      writeStorage(storageKeys.cart, state.cart);

      state.previousFocus = document.querySelector(
        '[data-action="open-cart"]'
      );

      elements.cartOverlay.hidden = true;
      unlockBodyIfNoDialog();
      renderCart();
      renderOrder();

      elements.orderOverlay.hidden = false;
      document.body.classList.add("dialog-open");

      // Fetch the current status immediately.
      refreshUserOrderStatus();

      // Stop any previous status checker.
      if (state.orderStatusTimer) {
        clearInterval(state.orderStatusTimer);
      }

      // Check for status changes every 5 seconds.
      state.orderStatusTimer = setInterval(() => {
        if (!elements.orderOverlay.hidden) {
          refreshUserOrderStatus();
        } else {
          clearInterval(state.orderStatusTimer);
          state.orderStatusTimer = null;
        }
      }, 5000);

      elements.orderOverlay
        .querySelector('[data-action="close-order"]')
        ?.focus();

      announce(
        `Order placed! Pickup number: ${order.number}.`
      );

    } catch (error) {
      console.error("Order submission failed:", error);
      alert(
        error.message ||
        "Your order could not be saved. Check the server and try again."
      );
    }
  }


  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    closeMobileNav();
  }

  function closeMobileNav() {
    elements.mainNavigation?.classList.remove("is-open");
    elements.mobileMenu?.setAttribute("aria-expanded", "false");
    elements.mobileMenu?.setAttribute("aria-label", "Open navigation");
  }

  function resetMenu() {
    state.filter = "All Items";
    state.search = "";

    elements.search.value = "";
    elements.clearSearch.hidden = true;

    renderCategories();
    renderProducts();
  }

  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;

    const target = event.target;
    const scrollControl = target.closest("[data-scroll]");

    if (scrollControl) {
      scrollToSection(scrollControl.dataset.scroll);
      return;
    }

    const filterControl = target.closest("[data-filter]");

    if (filterControl) {
      state.filter = filterControl.dataset.filter || "All Items";
      renderCategories();
      renderProducts();
      return;
    }

    const control = target.closest("[data-action]");
    if (!control) return;

    const { action, id } = control.dataset;

    switch (action) {
      case "toggle-nav": {
        const isOpen =
          elements.mainNavigation.classList.toggle("is-open");

        elements.mobileMenu.setAttribute(
          "aria-expanded",
          String(isOpen)
        );

        elements.mobileMenu.setAttribute(
          "aria-label",
          isOpen ? "Close navigation" : "Open navigation"
        );
        break;
      }

      case "open-cart":
        openCart();
        break;

      case "close-cart":
        closeCart();
        break;

      case "browse-menu":
        closeCart();
        scrollToSection("menu");
        break;

      case "add":
        if (id) addToCart(id);
        break;

      case "increase":
        if (id) changeQuantity(id, 1);
        break;

      case "decrease":
        if (id) changeQuantity(id, -1);
        break;

      case "remove":
        if (id) removeFromCart(id);
        break;

      case "place-order":
        placeOrder();
        break;

      case "view-order":
        openOrder();
        break;

      case "close-order":
        closeOrder();
        break;

      case "clear-search":
        elements.search.value = "";
        state.search = "";
        elements.clearSearch.hidden = true;
        renderProducts();
        elements.search.focus();
        break;

      case "reset-menu":
        resetMenu();
        break;
    }
  });

  elements.search?.addEventListener("input", () => {
    state.search = elements.search.value;
    elements.clearSearch.hidden = !state.search;
    renderProducts();
  });

  elements.cartOverlay?.addEventListener("click", event => {
    if (event.target === elements.cartOverlay) closeCart();
  });

  elements.orderOverlay?.addEventListener("click", event => {
    if (event.target === elements.orderOverlay) closeOrder();
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    if (!elements.orderOverlay.hidden) {
      closeOrder();
    } else if (!elements.cartOverlay.hidden) {
      closeCart();
    } else {
      closeMobileNav();
    }
  });

  renderCategories();
  renderProducts();
  renderCart();
  loadProducts();
}
/* ============================
   CANTEENGO ADMIN DASHBOARD
============================ */

(() => {
  // Run this section only on admin.html.
  if (!window.location.pathname.endsWith("admin.html")) {
    return;
  }

  const ordersTable = document.getElementById("ordersTable");
  const foodList = document.getElementById("foodList");
  const messageBox = document.getElementById("adminMessage");

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function showMessage(message, isError = false) {
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.style.color = isError ? "#b42318" : "#16713e";
  }

  // Common function for calling the Spring Boot API.

  async function apiRequest(url, options = {}) {
    const headers = {
      ...options.headers
    };

    // FormData uploads must let the browser set Content-Type
    // and its multipart boundary automatically.
    if (options.body instanceof FormData) {
      delete headers["Content-Type"];
      delete headers["content-type"];
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        responseText ||
        `Request failed (${response.status})`
      );
    }

    return data;
  }


  function formatMoney(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getFoodId(food) {
    return food.foodId ?? food._id ?? food.id;
  }

  function getFoodName(food) {
    return food.foodName ?? food.name ?? "Food item";
  }

  function getCategoryName(food) {
    return typeof food.category === "object"
      ? food.category?.categoryName || "Other"
      : food.category || "Other";
  }

  /* Load dashboard statistics */
  async function loadStats() {
    const stats = await apiRequest("/api/admin/stats");

    const totalOrders = document.getElementById("totalOrders");
    const pendingOrders = document.getElementById("pendingOrders");
    const completedSales = document.getElementById("completedSales");

    if (totalOrders) {
      totalOrders.textContent = stats.totalOrders ?? 0;
    }

    if (pendingOrders) {
      pendingOrders.textContent = stats.pendingOrders ?? 0;
    }

    if (completedSales) {
      completedSales.textContent = formatMoney(stats.completedSales);
    }
  }

  /* Load all customer orders */
  async function loadOrders() {
    const orders = await apiRequest("/api/orders");

    if (!Array.isArray(orders) || orders.length === 0) {
      ordersTable.innerHTML =
        '<tr><td colspan="6">No orders yet.</td></tr>';
      return;
    }

    ordersTable.innerHTML = orders.map(order => {
      const orderId = order._id ?? order.orderId ?? order.id;
      const orderTotal = order.total ?? order.totalAmount ?? 0;

      const itemsText = Array.isArray(order.items)
        ? order.items.map(item => {
          if (typeof item === "string") {
            return escapeHTML(item);
          }

          const name = escapeHTML(
            item.name ?? item.foodName ?? "Food item"
          );

          const quantity = Number(item.quantity || 1);

          return `${name} × ${quantity}`;
        }).join("<br>")
        : escapeHTML(order.items || "");

      const statuses = [
        { value: "PENDING", label: "Pending" },
        { value: "PREPARING", label: "Preparing" },
        { value: "READY", label: "Ready" },
        { value: "COMPLETED", label: "Completed" }
      ];

      const currentStatus =
        String(order.orderStatus ?? order.status ?? "PENDING").toUpperCase();

      const options = statuses.map(status => `
    <option value="${status.value}"
        ${currentStatus === status.value ? "selected" : ""}>
        ${status.label}
    </option>
`).join("");

      return `
        <tr>
          <td title="${escapeHTML(orderId)}">
            ${escapeHTML(String(orderId).slice(-6))}
          </td>

          <td>${escapeHTML(order.customerName || "Customer")}</td>

          <td>${itemsText}</td>

          <td>${formatMoney(orderTotal)}</td>

          <td>${escapeHTML(
        (order.orderStatus ?? order.status ?? "PENDING")
          .toString()
          .replaceAll("_", " ")
      )}</td>

          <td>
            <select class="status-select"
                    aria-label="New order status"
                    data-id="${escapeHTML(orderId)}">
              ${options}
            </select>

            <button type="button"
                    class="update-status"
                    data-id="${escapeHTML(orderId)}">
              Save
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  /* Update order status */
  ordersTable?.addEventListener("click", async event => {
    const button = event.target.closest(".update-status");
    if (!button) return;

    const id = button.dataset.id;

    const select = ordersTable.querySelector(
      `.status-select[data-id="${CSS.escape(id)}"]`
    );

    if (!select) {
      showMessage("Could not find the status selector.", true);
      return;
    }

    button.disabled = true;

    try {
      await apiRequest(`/api/orders/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: select.value
        })
      });

      showMessage("Order status updated successfully.");
      await refreshDashboard();

    } catch (error) {
      console.error("Status update error:", error);
      showMessage(error.message, true);

    } finally {
      button.disabled = false;
    }
  });

  /* Load food items */
  async function loadFoods() {
    const foods = await apiRequest("/api/foods");

    if (!Array.isArray(foods) || foods.length === 0) {
      foodList.textContent = "No food items added yet.";
      return;
    }


    foodList.innerHTML = foods.map(food => {
      const id = getFoodId(food);
      const name = getFoodName(food);
      const category = getCategoryName(food);

      // Get the image URL from the backend
      const imageUrl = food.imageUrl
        ? `http://localhost:8080/uploads/food/${food.imageUrl}`
        : "";

      return `
    <article class="food-item">
      <div class="food-details">
        ${imageUrl
          ? `<img
                 src="${escapeHTML(imageUrl)}"
                 alt="${escapeHTML(name)}"
                 class="food-image"
                 onerror="this.style.display='none'"
               >`
          : ""
        }

        <div>
          <h4>${escapeHTML(name)}</h4>
          <p>
            ${escapeHTML(category)} · ${formatMoney(food.price)}
          </p>
        </div>
      </div>

      <button type="button"
              class="delete-food"
              data-id="${escapeHTML(id)}">
        Remove
      </button>
    </article>
  `;
    }).join("");

  }


  /* Add food item through Java backend with image upload */
  const foodForm = document.getElementById("foodForm");

  foodForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const nameInput = document.getElementById("foodName");
    const priceInput = document.getElementById("foodPrice");
    const categoryInput = document.getElementById("foodCategory");
    const imageInput = document.getElementById("foodImage");
    const imageStatus = document.getElementById("foodImageStatus");

    const name = nameInput.value.trim();
    const price = Number(priceInput.value);
    const category = categoryInput.value.trim();
    const imageFile = imageInput?.files?.[0];

    if (!name || !Number.isFinite(price) || price <= 0) {
      showMessage("Enter a valid food name and price.", true);
      return;
    }

    if (!category) {
      showMessage("Please enter a food category.", true);
      return;
    }

    if (imageFile && !imageFile.type.startsWith("image/")) {
      showMessage("Please select a valid image.", true);
      return;
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      showMessage("Image must be 5 MB or smaller.", true);
      return;
    }

    const submitButton = foodForm.querySelector(
      'button[type="submit"]'
    );

    if (submitButton) submitButton.disabled = true;

    try {
      let imageUrl = null;

      // Step 1: Upload the selected image, if provided.
      if (imageFile) {
        if (imageStatus) {
          imageStatus.textContent = "Uploading image...";
        }

        const formData = new FormData();
        formData.append("image", imageFile);

        const uploadResult = await apiRequest(
          "/api/foods/upload-image",
          {
            method: "POST",
            body: formData
          }
        );

        imageUrl = uploadResult.imageUrl;
      }

      // Step 2: Save the food details and image path.
      await apiRequest("/api/foods", {
        method: "POST",
        body: JSON.stringify({
          name,
          price,
          category,
          imageUrl
        })
      });

      foodForm.reset();

      const preview = document.getElementById("foodImagePreview");
      if (preview) {
        preview.removeAttribute("src");
        preview.style.display = "none";
      }

      if (imageStatus) imageStatus.textContent = "";

      showMessage("Food item added successfully.");
      await loadFoods();

    } catch (error) {
      console.error("Add food error:", error);
      showMessage(error.message || "Could not add food item.", true);

    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  /* Remove food item — keep your existing code */
  foodList?.addEventListener("click", async event => {
    const button = event.target.closest(".delete-food");
    if (!button) return;

    const confirmed = confirm(
      "Are you sure you want to remove this food item?"
    );

    if (!confirmed) return;

    button.disabled = true;

    try {
      await apiRequest(
        `/api/foods/${encodeURIComponent(button.dataset.id)}`,
        { method: "DELETE" }
      );

      showMessage("Food item removed successfully.");
      await loadFoods();

    } catch (error) {
      console.error("Remove food error:", error);
      showMessage(error.message, true);

    } finally {
      button.disabled = false;
    }
  });

  /* Refresh all admin dashboard data */
  async function refreshDashboard() {
    try {
      showMessage("Refreshing dashboard...");

      await Promise.all([
        loadStats(),
        loadOrders(),
        loadFoods()
      ]);

      showMessage("Dashboard data is up to date.");

    } catch (error) {
      console.error("Dashboard loading error:", error);

      showMessage(
        error.message +
        ". Check that Spring Boot and MySQL are running.",
        true
      );
    }
  }

  document.getElementById("refreshDashboard")
    ?.addEventListener("click", refreshDashboard);

  // Load dashboard when admin.html opens.
  refreshDashboard();

  const foodImageInput = document.getElementById("foodImage");
  const uploadFoodImageButton = document.getElementById("uploadFoodImageButton");
  const foodImagePreview = document.getElementById("foodImagePreview");
  const foodImageStatus = document.getElementById("foodImageStatus");

  uploadFoodImageButton?.addEventListener("click", () => {
    foodImageInput?.click();
  });

  foodImageInput?.addEventListener("change", () => {
    const file = foodImageInput.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      foodImageStatus.textContent = "Please select an image.";
      foodImageInput.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      foodImageStatus.textContent = "Image must be 5 MB or smaller.";
      foodImageInput.value = "";
      return;
    }

    foodImagePreview.src = URL.createObjectURL(file);
    foodImagePreview.style.display = "block";
    foodImageStatus.textContent = "Selected: " + file.name;
  });

})();