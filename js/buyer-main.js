const API_BASE_URL = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", function () {
  if (!checkAuth() || !checkUserType("buyer")) {
    return;
  }

  updateCartCount();
  updateUserInfo();
  loadBuyerOrders();
  setupEventListeners();
});

function checkAuth() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!token || !user) {
    alert("You must be logged in to view this page.");
    window.location.href = "./index.html";
    return false;
  }
  return true;
}

function checkUserType(expectedType) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user.userType !== expectedType) {
    alert(`Access Denied: Only ${expectedType}s can view this page.`);
    window.location.href = "./index.html";
    return false;
  }
  return true;
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "./index.html";
  }
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountElements = document.querySelectorAll("#cartCount");
  cartCountElements.forEach((el) => (el.textContent = totalItems));
}

function updateUserInfo() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    const buyerName = document.getElementById("buyerName");
    const buyerEmail = document.getElementById("buyerEmail");
    const userAvatar = document.getElementById("userAvatar");
    const headerAvatar = document.getElementById("headerAvatar");

    if (buyerName) buyerName.textContent = user.fullName;
    if (buyerEmail) buyerEmail.textContent = user.email;

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user.fullName || "Buyer"
    )}&background=2196F3&color=fff`;
    if (userAvatar) userAvatar.src = avatarUrl;
    if (headerAvatar) headerAvatar.src = avatarUrl;
  }
}

function setupEventListeners() {
  document.getElementById("logoutBtn").addEventListener("click", logout);

  document.querySelector(".user-menu").addEventListener("click", showProfileModal);
  document.querySelector("#viewAllRecentOrders").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Viewing all recent orders! (To be implemented)");
  });
  document.querySelector("#viewAllOrderHistory").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Viewing all order history! (To be implemented)");
  });
}

async function loadBuyerOrders() {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();

    if (response.ok && data.success) {
      const orders = data.orders;
      renderOrders(orders);
      updateOrderStats(orders);
    } else {
      console.error("Failed to load buyer orders:", data.message);
      showNotification(data.message || "Failed to load orders", "error");
    }
  } catch (error) {
    console.error("Error loading buyer orders:", error);
    showNotification("Error loading orders. Please try again.", "error");
  }
}

function renderOrders(orders) {
  const recentOrdersList = document.getElementById("recentOrdersList");
  const orderHistoryList = document.getElementById("orderHistoryList");

  if (!recentOrdersList || !orderHistoryList) return;

  recentOrdersList.innerHTML = "";
  orderHistoryList.innerHTML = "";

  const now = new Date();
  const twoDaysAgo = new Date(now.setDate(now.getDate() - 2));

  const recentOrders = orders.filter((order) => new Date(order.createdAt) > twoDaysAgo);
  const orderHistory = orders.filter((order) => new Date(order.createdAt) <= twoDaysAgo);

  if (recentOrders.length === 0) {
    recentOrdersList.innerHTML = `
      <p style="text-align: center; padding: 2rem; color: #666;">
        <i class="fas fa-shopping-cart" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
        No recent orders.
      </p>
    `;
  } else {
    recentOrders.forEach((order) => {
      recentOrdersList.appendChild(createOrderItemElement(order));
    });
  }

  if (orderHistory.length === 0) {
    orderHistoryList.innerHTML = `
      <p style="text-align: center; padding: 2rem; color: #666;">
        <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
        No past orders.
      </p>
    `;
  } else {
    orderHistory.forEach((order) => {
      orderHistoryList.appendChild(createOrderItemElement(order));
    });
  }
}

function createOrderItemElement(order) {
  const orderItem = document.createElement("div");
  orderItem.className = "order-item";
  orderItem.onclick = () => viewOrderDetails(order._id);

  let statusClass = "pending";
  if (order.status === "processing") statusClass = "processing";
  else if (order.status === "shipped") statusClass = "shipped";
  else if (order.status === "delivered") statusClass = "delivered";
  else if (order.status === "cancelled") statusClass = "cancelled";

  const orderNumber = order.orderNumber || `ORD-${order._id?.slice(-4) || "0000"}`;
  const itemsSummary = order.items.map(item => `${item.productDetails.name} (${item.quantity}${item.productDetails.unit})`).join(", ");

  orderItem.innerHTML = `
    <div class="order-info">
      <h4>${orderNumber}</h4>
      <p>${itemsSummary}</p>
      <p class="order-meta">
        ${new Date(order.createdAt).toLocaleDateString()} •
        <span class="status-badge ${statusClass}">${order.status}</span>
      </p>
    </div>
    <div class="order-actions">
      <h4 style="margin: 0; color: var(--primary-green);">${order.totalPrice} ETB</h4>
      <button class="btn-small btn-primary">View Details</button>
    </div>
  `;
  return orderItem;
}

async function viewOrderDetails(orderId) {
  window.location.href = `success.html?orderId=${orderId}`;
}

function updateOrderStats(orders) {
  const totalOrdersElement = document.getElementById("totalOrders");
  const completedOrdersElement = document.getElementById("completedOrders");
  const pendingOrdersElement = document.getElementById("pendingOrders");
  const averageRatingElement = document.getElementById("averageRating");

  const totalOrders = orders.length;
  const completedOrders = orders.filter(order => order.status === "delivered").length;
  const pendingOrders = orders.filter(order => order.status === "pending" || order.status === "processing" || order.status === "shipped").length;
  
  const ratedOrders = orders.filter(order => order.rating > 0);
  const totalRating = ratedOrders.reduce((sum, order) => sum + order.rating, 0);
  const averageRating = ratedOrders.length > 0 ? (totalRating / ratedOrders.length).toFixed(1) : "0.0";

  if (totalOrdersElement) totalOrdersElement.textContent = totalOrders;
  if (completedOrdersElement) completedOrdersElement.textContent = completedOrders;
  if (pendingOrdersElement) pendingOrdersElement.textContent = pendingOrders;
  if (averageRatingElement) averageRatingElement.textContent = averageRating;
}

// Profile Modal Functions (re-used from farmer-main.js, can be refactored to a common utility)
async function showProfileModal() {
  const modal = document.createElement("div");
  modal.id = "profileModal";
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;";

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/auth/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    const user = data.user || JSON.parse(localStorage.getItem("user"));

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto;">
        <div style="padding: 1.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">My Profile</h3>
          <button onclick="closeProfileModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">&times;</button>
        </div>
        <form id="profileForm" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Full Name *</label>
            <input type="text" id="fullName" name="fullName" value="${
              user.fullName || ""
            }" required 
                   style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email</label>
            <input type="email" id="email" value="${
              user.email || ""
            }" disabled 
                   style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; background: #f5f5f5; cursor: not-allowed;">
            <small style="color: #666;">Email cannot be changed</small>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Phone Number *</label>
              <input type="tel" id="phone" name="phone" value="${
                user.phone || ""
              }" required 
                     style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">City *</label>
              <input type="text" id="city" name="city" value="${
                user.city || ""
              }" required 
                     style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
            </div>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Address</label>
            <textarea id="address" name="address" rows="2" 
                      style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">${
                        user.address || ""
                      }</textarea>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button type="button" onclick="closeProfileModal()" 
                    style="flex: 1; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; background: #f8f9fa; cursor: pointer;">
              Cancel
            </button>
            <button type="submit" 
                    style="flex: 1; padding: 0.75rem; border: none; border-radius: 6px; background: #2f8f44; color: white; font-weight: 600; cursor: pointer;">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById("profileForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleProfileSubmit();
      });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeProfileModal();
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 2rem; text-align: center;">
        <p style="color: #f44336;">Login as a buyer first</p>
        <button onclick="closeProfileModal()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #2f8f44; color: white; border: none; border-radius: 6px; cursor: pointer;">
          Close
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

async function handleProfileSubmit() {
  const formData = {
    fullName: document.getElementById("fullName").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    city: document.getElementById("city").value.trim(),
    address: document.getElementById("address").value.trim(),
  };

  if (!formData.fullName || !formData.phone || !formData.city) {
    showNotification("Please fill all required fields (*)", "error");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/auth/profile`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }
    );

    const data = await response.json();

    if (response.ok && data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      updateUserInfo();
      closeProfileModal();
      showNotification("Profile updated successfully! 🎉", "success");
    } else {
      showNotification(data.message || "Failed to update profile", "error");
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    showNotification("Failed to update profile. Please try again.", "error");
  }
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.remove();
}

function showNotification(message, type = "info") {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll(
    ".notification-toast"
  );
  existingNotifications.forEach((notification) => notification.remove());

  // Create notification element
  const notification = document.createElement("div");
  notification.className = "notification-toast";

  const icon = type === "success" ? "✓" : type === "error" ? "✗" : "ℹ️";
  const bgColor =
    type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3";

  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1rem;">
      <div style="background: ${bgColor}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
        ${icon}
      </div>
      <div>
        <p style="margin: 0; font-weight: 500;">${message}</p>
      </div>
    </div>
    <button class="close-notif" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #666;">&times;</button>
  `;

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    z-index: 9999;
    animation: slideInRight 0.3s ease;
    max-width: 350px;
    border-left: 4px solid ${bgColor};
  `;

  notification.querySelector(".close-notif").addEventListener("click", () => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  });

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

window.showProfileModal = showProfileModal;
window.closeProfileModal = closeProfileModal;

