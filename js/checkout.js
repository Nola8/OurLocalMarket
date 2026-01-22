const CHAPA_CONFIG = {
  publicKey: "CHAPUBK_TEST-xxxxxxxxxxxx",
  txRef: `TXN-${Date.now()}`,
  currency: "ETB",
  amount: 0,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  callbackUrl: "http://localhost:5500/success.html",
  returnUrl: "http://localhost:5500/success.html",
  customization: {
    title: "Our Local Market",
    description: "Fresh agricultural products",
  },
};

document.addEventListener("DOMContentLoaded", function () {
  const user = JSON.parse(localStorage.getItem("user"));

  if (user) {
    CHAPA_CONFIG.firstName = user.fullName.split(" ")[0] || "";
    CHAPA_CONFIG.lastName = user.fullName.split(" ").slice(1).join(" ") || "";
    CHAPA_CONFIG.email = user.email || "";
    CHAPA_CONFIG.phone = user.phone || "";
  }

  loadOrderSummary();
  updateCartCount();
  setupEventListeners();
  setupPaymentToggle();
});

function loadOrderSummary() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const orderItemsContainer = document.getElementById("orderItems");

  if (cart.length === 0) {
    window.location.href = "cart.html";
    return;
  }

  let html = "";
  let subtotal = 0;

  cart.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    html += `
            <div class="order-item">
                <div class="item-info">
                    <img src="${item.image}" alt="${item.name}" 
                         onerror="this.src='https://via.placeholder.com/60x60?text=Product'">
                    <div>
                        <h4>${item.name}</h4>
                        <p>${item.price} ETB × ${item.quantity} ${item.unit}</p>
                    </div>
                </div>
                <span class="item-price">${itemTotal} ETB</span>
            </div>
        `;
  });

  orderItemsContainer.innerHTML = html;
  updateOrderTotals(subtotal);
}

function updateOrderTotals(subtotal) {
  const deliveryFee = 50;
  const total = subtotal + deliveryFee;

  document.getElementById("orderSubtotal").textContent = `${subtotal} ETB`;
  document.getElementById("orderTotal").textContent = `${total} ETB`;

  // Update Chapa config with total amount
  CHAPA_CONFIG.amount = total;
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountElements = document.querySelectorAll("#cartCount");
  cartCountElements.forEach((el) => (el.textContent = totalItems));
}

function setupEventListeners() {
  const form = document.getElementById("checkoutForm");
  form.addEventListener("submit", handleSubmit);

  document.getElementById("fullName").addEventListener("input", function () {
    const names = this.value.split(" ");
    CHAPA_CONFIG.firstName = names[0] || "";
    CHAPA_CONFIG.lastName = names.slice(1).join(" ") || "";
  });

  document.getElementById("email").addEventListener("input", function () {
    CHAPA_CONFIG.email = this.value;
  });

  document.getElementById("phone").addEventListener("input", function () {
    CHAPA_CONFIG.phone = this.value;
  });
}

function setupPaymentToggle() {
  const paymentOptions = document.querySelectorAll('input[name="payment"]');
  const payNowBtn = document.getElementById("payNowBtn");
  const codBtn = document.getElementById("codBtn");

  paymentOptions.forEach((option) => {
    option.addEventListener("change", function () {
      if (this.value === "cash") {
        payNowBtn.style.display = "none";
        codBtn.style.display = "block";
      } else {
        payNowBtn.style.display = "block";
        codBtn.style.display = "none";
      }
    });
  });

  codBtn.addEventListener("click", function () {
    if (validateForm()) {
      simulateOrder("cash");
    }
  });
}

function handleSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  const paymentMethod = document.querySelector(
    'input[name="payment"]:checked',
  ).value;

  if (paymentMethod === "chapa") {
    processChapaPayment();
  } else {
    simulateOrder("cash");
  }
}

function validateForm() {
  const form = document.getElementById("checkoutForm");
  const terms = document.getElementById("terms");

  if (!form.checkValidity()) {
    alert("Please fill in all required fields correctly.");
    return false;
  }

  if (!terms.checked) {
    alert("Please agree to the terms and conditions.");
    return false;
  }

  return true;
}

async function processChapaPayment() {
  const user = JSON.parse(localStorage.getItem("user"));
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  if (!user || !user.id) {
    alert("User not logged in or user ID not available.");
    window.location.href = "index.html";
    return;
  }

  if (cart.length === 0) {
    alert("Your cart is empty. Please add items before checking out.");
    window.location.href = "shop.html";
    return;
  }

  const shippingAddress = {
    address: document.getElementById("address").value,
    city: document.getElementById("city").value,
    phone: document.getElementById("phone").value,
  };

  const orderItems = cart.map((item) => ({
    product: item.productId,
    quantity: item.quantity,
  }));

  const orderData = {
    items: orderItems,
    shippingAddress,
    paymentMethod: "chapa",
    notes: document.getElementById("notes").value,
  };

  try {
    const token = localStorage.getItem("token");
    const createOrderResponse = await fetch(
      "http://localhost:5000/api/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      },
    );

    const createOrderResult = await createOrderResponse.json();

    if (!createOrderResponse.ok || !createOrderResult.success) {
      throw new Error(createOrderResult.message || "Failed to create order");
    }

    const orderId = createOrderResult.order._id;

    // Store orderId in localStorage for Chapa callback to use
    localStorage.setItem("pendingOrder", JSON.stringify({ orderId: orderId }));

    CHAPA_CONFIG.txRef = `TXN-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    CHAPA_CONFIG.amount = createOrderResult.order.totalPrice;
    CHAPA_CONFIG.callbackUrl = `http://localhost:5500/success.html?orderId=${orderId}&payment_status=success`;
    CHAPA_CONFIG.returnUrl = `http://localhost:5500/success.html?orderId=${orderId}&payment_status=success`;

    const chapa = new window.Chapa({
      ...CHAPA_CONFIG,
      onClose: () => {
        console.log("Payment window closed");
      },
      onSuccess: async (data) => {
        console.log("Payment successful:", data);

        try {
          const markPaidResponse = await fetch(
            "http://localhost:5000/api/payments/mark-paid",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ orderId: orderId }),
            },
          );

          const markPaidResult = await markPaidResponse.json();

          if (!markPaidResponse.ok || !markPaidResult.success) {
            throw new Error(
              markPaidResult.message ||
                "Failed to mark order as paid after Chapa success",
            );
          }
          localStorage.removeItem("cart");
          localStorage.removeItem("pendingOrder");
          window.location.href = `success.html?orderId=${orderId}`;
        } catch (error) {
          console.error(
            "Error marking order as paid after Chapa success:",
            error,
          );
          alert(
            "Payment was successful, but there was an issue updating order status. Please contact support.",
          );
        }
      },
      onError: (error) => {
        console.error("Payment error:", error);
        alert("Payment failed. Please try again.");
        // Optionally, update order status to 'failed' on the backend
      },
    });

    chapa.open();
  } catch (error) {
    console.error("Error initiating Chapa payment:", error);
    alert("Failed to initiate payment: " + error.message);
  }
}

async function simulateOrder(paymentMethod) {
  const user = JSON.parse(localStorage.getItem("user"));
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  if (!user || !user.id) {
    alert("User not logged in or user ID not available.");
    window.location.href = "index.html";
    return;
  }

  if (cart.length === 0) {
    alert("Your cart is empty. Please add items before checking out.");
    window.location.href = "shop.html";
    return;
  }

  const shippingAddress = {
    address: document.getElementById("address").value,
    city: document.getElementById("city").value,
    phone: document.getElementById("phone").value,
  };

  const orderItems = cart.map((item) => ({
    product: item.productId,
    quantity: item.quantity,
  }));

  const orderData = {
    items: orderItems,
    shippingAddress,
    paymentMethod: paymentMethod === "cash" ? "cash_on_delivery" : "chapa",
    notes: document.getElementById("notes").value,
  };

  try {
    const token = localStorage.getItem("token");
    const createOrderResponse = await fetch(
      "http://localhost:5000/api/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      },
    );

    const createOrderResult = await createOrderResponse.json();

    if (!createOrderResponse.ok || !createOrderResult.success) {
      throw new Error(createOrderResult.message || "Failed to create order");
    }

    const orderId = createOrderResult.order._id;
    let redirectUrl = `success.html?orderId=${orderId}`;

    if (paymentMethod === "cash") {
      alert(
        `Order placed successfully!\nOrder ID: ${createOrderResult.order.orderNumber}\nPayment: Cash on Delivery`,
      );
      localStorage.removeItem("cart");
      window.location.href = redirectUrl;
    } else if (paymentMethod === "chapa") {
      // Mark order as paid after Chapa payment success
      const markPaidResponse = await fetch(
        "http://localhost:5000/api/payments/mark-paid",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId: orderId }),
        },
      );

      const markPaidResult = await markPaidResponse.json();

      if (!markPaidResponse.ok || !markPaidResult.success) {
        throw new Error(
          markPaidResult.message || "Failed to mark order as paid",
        );
      }
      localStorage.removeItem("cart");
      window.location.href = redirectUrl;
    }
  } catch (error) {
    console.error("Error placing order:", error);
    alert("Failed to place order: " + error.message);
  }
}

async function testChapaPayment() {
  alert(
    "This is a demo. In production, this would redirect to Chapa payment gateway.\n\nFor testing Chapa:\n1. Sign up at https://dashboard.chapa.co\n2. Get your test public key\n3. Replace CHAPUBK_TEST-xxxxxxxxxxxx with your actual key\n\nFor now, we'll simulate payment success and backend interaction.",
  );

  const user = JSON.parse(localStorage.getItem("user"));
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  if (!user || !user.id) {
    alert("User not logged in or user ID not available.");
    window.location.href = "index.html";
    return;
  }

  if (cart.length === 0) {
    alert("Your cart is empty. Please add items before checking out.");
    window.location.href = "shop.html";
    return;
  }

  const shippingAddress = {
    address: document.getElementById("address").value,
    city: document.getElementById("city").value,
    phone: document.getElementById("phone").value,
  };

  const orderItems = cart.map((item) => ({
    product: item.productId,
    quantity: item.quantity,
  }));

  const orderData = {
    items: orderItems,
    shippingAddress,
    paymentMethod: "chapa",
    notes: document.getElementById("notes").value,
  };

  try {
    const token = localStorage.getItem("token");
    const createOrderResponse = await fetch(
      "http://localhost:5000/api/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      },
    );

    const createOrderResult = await createOrderResponse.json();

    if (!createOrderResponse.ok || !createOrderResult.success) {
      throw new Error(
        createOrderResult.message ||
          "Failed to create order during test payment",
      );
    }

    const orderId = createOrderResult.order._id;

    const markPaidResponse = await fetch(
      "http://localhost:5000/api/payments/mark-paid",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: orderId }),
      },
    );

    const markPaidResult = await markPaidResponse.json();

    if (!markPaidResponse.ok || !markPaidResult.success) {
      throw new Error(
        markPaidResult.message ||
          "Failed to mark order as paid during test payment",
      );
    }

    localStorage.removeItem("cart");
    window.location.href = `success.html?orderId=${orderId}`;
  } catch (error) {
    console.error("Error during test Chapa payment:", error);
    alert("Test payment failed: " + error.message);
  }
}
