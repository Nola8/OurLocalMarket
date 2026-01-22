const API_BASE_URL = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("orderId");

  if (orderId) {
    fetchOrderDetails(orderId);
  } else {
    console.error("No order ID found in URL.");
    document.getElementById("orderDetails").innerHTML = `
      <p class="error-message">Failed to load order details. Please go to your <a href="buyer-dashboard.html">dashboard</a> to view your orders.</p>
    `;
  }

  updateCartCount();
  setupRatingSystem();
});

async function fetchOrderDetails(orderId) {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("User not authenticated.");
    }

    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      renderOrderDetails(data.order);
      if (data.order.status === "delivered") {
        showRatingSection(orderId, data.order);
      }
    } else {
      throw new Error(data.message || "Failed to fetch order details.");
    }
  } catch (error) {
    console.error("Error fetching order details:", error);
    document.getElementById("orderDetails").innerHTML = `
      <p class="error-message">Error: ${error.message}. Please try again later or check your <a href="buyer-dashboard.html">dashboard</a>.</p>
    `;
  }
}

function renderOrderDetails(order) {
  const orderDetailsContainer = document.getElementById("orderDetails");
  if (!orderDetailsContainer) return;

  let itemsHtml = order.items
    .map(
      (item) => `
    <div class="order-item-summary">
     
        <h4>${item.productDetails.name}</h4>
        <p>${item.quantity} ${item.productDetails.unit} x ${item.price} ETB</p>
      </div>
      <span>${item.subtotal} ETB</span>
    </div>
  `,
    )
    .join("");

  orderDetailsContainer.innerHTML = `
    <div class="detail-group">
      <strong>Order Number:</strong> <span>${order.orderNumber}</span>
    </div>
    <div class="detail-group">
      <strong>Order Date:</strong> <span>${new Date(order.createdAt).toLocaleDateString()}</span>
    </div>
    <div class="detail-group">
      <strong>Total Amount:</strong> <span>${order.totalPrice} ETB</span>
    </div>
    <div class="detail-group">
      <strong>Payment Method:</strong> <span>${order.paymentMethod.replace(/_/g, " ").toUpperCase()}</span>
    </div>
    <div class="detail-group">
      <strong>Payment Status:</strong> <span class="status-${order.paymentStatus}">${order.paymentStatus.toUpperCase()}</span>
    </div>
    <div class="detail-group">
      <strong>Order Status:</strong> <span class="status-${order.status}">${order.status.toUpperCase()}</span>
    </div>
    <div class="detail-group">
      <strong>Shipping Address:</strong> <span>${order.shippingAddress.address}, ${order.shippingAddress.city}</span>
    </div>
    <div class="order-items-summary">
      <h4>Items:</h4>
      ${itemsHtml}
    </div>
  `;

  // Update success message based on order status
  const successMessage = document.querySelector(".success-message");
  const successIcon = document.querySelector(".success-icon");

  if (order.status === "delivered") {
    successMessage.innerHTML = `
      Thank you for your purchase! Your order <strong style="color: var(--primary-green);">${order.orderNumber}</strong> has been successfully delivered.
      We hope you enjoy your fresh products!
    `;
    successIcon.innerHTML = "🎉";
  } else if (order.paymentStatus === "paid" && order.status !== "delivered") {
    successMessage.innerHTML = `
      Thank you for your purchase! Your order <strong style="color: var(--primary-green);">${order.orderNumber}</strong> has been confirmed and is being processed.
    `;
    successIcon.innerHTML = "✓";
  } else {
    successMessage.innerHTML = `
      Your order <strong style="color: var(--primary-green);">${order.orderNumber}</strong> has been received. Payment is pending.
    `;
    successIcon.innerHTML = "⌛";
  }
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountElements = document.querySelectorAll("#cartCount");
  cartCountElements.forEach((el) => (el.textContent = totalItems));
}

function showRatingSection(orderId, order) {
  const products = order.items
    .map((item) => {
      let productId = null;

      if (item.product) {
        if (typeof item.product === "string") {
          productId = item.product;
        } else if (item.product._id) {
          productId = item.product._id.toString();
        } else {
          productId = item.product.toString();
        }
      }

      return {
        productId: productId,
        productName: item.productDetails
          ? item.productDetails.name
          : "Unknown Product",
      };
    })
    .filter((item) => item.productId !== null);

  console.log("Storing products for rating:", products);
  document.getElementById("selectedRating").dataset.products =
    JSON.stringify(products);

  const ratingSection = document.getElementById("ratingSection");
  ratingSection.classList.add("show");

  document.getElementById("selectedRating").dataset.orderId = orderId;
}

function setupRatingSystem() {
  const stars = document.querySelectorAll(".star");
  const selectedRatingInput = document.getElementById("selectedRating");
  const submitRatingBtn = document.getElementById("submitRating");
  const skipRatingBtn = document.getElementById("skipRating");

  stars.forEach((star) => {
    star.addEventListener("click", function () {
      const value = parseInt(this.getAttribute("data-value"));
      selectedRatingInput.value = value;
      highlightStars(value);
    });

    star.addEventListener("mouseover", function () {
      const value = parseInt(this.getAttribute("data-value"));
      highlightStars(value);
    });
  });

  document
    .querySelector(".stars-container")
    .addEventListener("mouseleave", function () {
      const currentValue = parseInt(selectedRatingInput.value);
      highlightStars(currentValue);
    });

  submitRatingBtn.addEventListener("click", handleSubmitRating);
  skipRatingBtn.addEventListener("click", handleSkipRating);

  function highlightStars(value) {
    stars.forEach((s) => s.classList.remove("active"));
    for (let i = 0; i < value; i++) {
      stars[i].classList.add("active");
    }
  }
}

async function handleSubmitRating() {
  const rating = parseInt(document.getElementById("selectedRating").value);
  const comment = document.getElementById("ratingComment").value.trim();
  const orderId = document.getElementById("selectedRating").dataset.orderId;
  const productsData =
    document.getElementById("selectedRating").dataset.products || "[]";
  const products = JSON.parse(productsData);

  console.log("Rating submission data:", {
    rating,
    comment,
    orderId,
    products,
  });

  if (rating === 0 || !rating) {
    alert("Please select a rating by clicking the stars.");
    return;
  }

  if (!orderId) {
    alert("Order ID is missing. Please refresh the page and try again.");
    return;
  }

  if (!products || products.length === 0) {
    alert(
      "Product information is missing. Please refresh the page and try again.",
    );
    console.error("Products array is empty:", productsData);
    return;
  }

  // For simplicity, we'll rate the first product in the order.
  const productId = products[0]?.productId;

  if (!productId) {
    alert("Product ID is missing. Please refresh the page and try again.");
    console.error("ProductId is missing from products:", products);
    return;
  }

  try {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must be logged in to submit a rating.");
      return;
    }

    const requestBody = { rating, comment, productId };
    console.log("Sending request to /orders/:id/rate:", requestBody);

    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log("Response:", data);

    if (response.ok && data.success) {
      alert("Thank you for your feedback! Your rating has been submitted.");
      document.getElementById("ratingSection").innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <h3 style="color: #2f8f44;">✓ Rating Submitted!</h3>
          <p>Thank you for sharing your experience.</p>
        </div>
      `;
    } else {
      alert(data.message || "Failed to submit rating. Please try again.");
    }
  } catch (error) {
    console.error("Error submitting rating:", error);
    alert("Failed to submit rating. Please try again.");
  }
}

function handleSkipRating() {
  document.getElementById("ratingSection").style.display = "none";
}
