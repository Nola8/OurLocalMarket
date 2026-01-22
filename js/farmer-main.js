const API_BASE_URL = "http://localhost:5000/api";

let currentProductForEdit = null;

function checkAuth() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  console.log(" Auth check - Token:", !!token, "User:", !!user);

  if (!token || !user) {
    console.log(" No auth, redirecting to login");
    alert("You have to login as a farmer to access farmer dashboard ");
    window.location.href = "./index.html";
    return false;
  }

  if (user.userType !== "farmer") {
    alert("You have to login as a farmer to access farmer dashboard ");
    window.location.href = "./index.html";
    return false;
  }

  const nameElement = document.querySelector(".user-details h4");
  const farmElement = document.querySelector(".user-details p");

  if (nameElement) nameElement.textContent = user.fullName || "Farmer";
  if (farmElement) farmElement.textContent = user.farmName || "Farm";

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
    window.location.href = "../index.html";
  }
}

async function editProduct(productId) {
  try {
    showNotification("Loading product details...", "info");

    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      headers: getAuthHeaders(),
    });

    console.log(" Edit product response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to load product");
    }

    const data = await response.json();
    console.log(" Product data received:", data);

    if (!data.success || !data.product) {
      throw new Error("Product data not found");
    }

    showEditProductModal(data.product);
  } catch (error) {
    console.error(" Error in editProduct:", error);
    showNotification(
      "Failed to load product for editing: " + error.message,
      "error",
    );
  }
}

document.addEventListener("DOMContentLoaded", function () {
  if (!checkAuth()) return;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  } else {
    console.warn(" Logout button not found!");
  }

  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) {
    profileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showProfileModal();
    });
  }

  const userMenuBtn = document.getElementById("userMenuBtn");
  if (userMenuBtn) {
    userMenuBtn.addEventListener("click", () => {
      showProfileModal();
    });
  }

  loadDashboardData();

  setupEventListeners();
});

function setupEventListeners() {
  console.log("🎯 Setting up event listeners...");

  const addProductBtn = document.querySelector(".btn-add");
  const addNewBtn = document.querySelector(".btn-small");
  const modal = document.getElementById("productModal");
  const closeModal = document.querySelector(".close-modal");

  [addProductBtn, addNewBtn].forEach((btn) => {
    btn?.addEventListener("click", () => {
      console.log("➕ Add product clicked");
      showAddProductModal();
    });
  });

  closeModal?.addEventListener("click", () => {
    console.log(" Close modal clicked");
    closeProductModal();
  });

  // Close modal when clicking outside
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      console.log(" Clicked outside modal");
      closeProductModal();
    }
  });

  // Profile modal close handlers
  const profileModal = document.getElementById("profileModal");
  if (profileModal) {
    profileModal.addEventListener("click", (e) => {
      if (e.target === profileModal) {
        closeProfileModal();
      }
    });
  }
}

async function loadDashboardData() {
  try {
    await loadFarmerProducts();
    await loadFarmerFeedback();

    const farmerProfileResponse = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: getAuthHeaders(),
    });

    let farmerAverageRating = 0;
    let farmerNumberOfRatings = 0;

    if (farmerProfileResponse.ok) {
      const profileData = await farmerProfileResponse.json();
      if (profileData.success && profileData.user) {
        farmerAverageRating = profileData.user.averageRating || 0;
        farmerNumberOfRatings = profileData.user.numberOfRatings || 0;
      }
    } else {
      console.error(
        "❌ Failed to load farmer profile for ratings:",
        await farmerProfileResponse.text(),
      );
    }

    const statsResponse = await fetch(`${API_BASE_URL}/orders/farmer/stats`, {
      headers: getAuthHeaders(),
    });

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log("📊 Stats received:", statsData);
      // Pass the actual average rating to updateStats
      updateStats({
        ...statsData.stats,
        averageRating: farmerAverageRating,
        numberOfRatings: farmerNumberOfRatings,
      });
    } else {
      console.error("❌ Failed to load stats:", await statsResponse.text());
    }

    const ordersResponse = await fetch(`${API_BASE_URL}/orders/farmer/orders`, {
      headers: getAuthHeaders(),
    });

    console.log("Orders API Response Status:", ordersResponse.status);

    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      console.log("ORDERS DATA FROM API:", ordersData);
      renderRecentOrders(ordersData.orders);
    } else {
      const errorText = await ordersResponse.text();
      console.error(
        "❌ API Error - Failed to load orders. Status:",
        ordersResponse.status,
        "Response:",
        errorText,
      );
      showNotification(
        `Failed to load orders: ${ordersResponse.status} - ${errorText.substring(0, 100)}...`,
        "error",
      );
    }
  } catch (error) {
    console.error(" Error loading dashboard data:", error);
    showNotification("Failed to load dashboard data", "error");
  }
}

async function loadFarmerProducts() {
  console.log("🔄 Loading farmer products...");

  try {
    const response = await fetch(
      `${API_BASE_URL}/products/farmer/my-products`,
      {
        headers: getAuthHeaders(),
      },
    );

    console.log("📦 Products response:", response.status);

    if (response.ok) {
      const productsData = await response.json();
      console.log(
        "📦 Products received:",
        productsData.products?.length,
        "items",
      );
      renderProductsTable(productsData.products);
    } else {
      console.error("❌ Failed to load products:", await response.text());
    }
  } catch (error) {
    console.error("💥 Error loading products:", error);
  }
}

function renderProductsTable(products) {
  const tbody = document.querySelector(".products-table tbody");
  if (!tbody) {
    console.error(" Products table body not found!");
    return;
  }

  console.log("Rendering products table with", products?.length, "products");

  tbody.innerHTML = "";

  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem;">
          <i class="fas fa-seedling" style="font-size: 2rem; color: #ccc; margin-bottom: 1rem; display: block;"></i>
          <p>No products yet. Click "Add New" to add your first product!</p>
        </td>
      </tr>
    `;
    return;
  }

  products.forEach((product) => {
    const stockPercentage = Math.min((product.stock / 100) * 100, 100);

    let statusClass = "active";
    let statusText = "Active";

    if (product.stock <= 0) {
      statusClass = "out";
      statusText = "Out of Stock";
    } else if (product.stock < 10) {
      statusClass = "low";
      statusText = "Low Stock";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="product-info">
        <img src="${product.image || "../pictures/default-product.jpg"}" 
             alt="${product.name}"
             onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'">
        <div>
          <h4>${product.name}</h4>
          <p>${product.category}</p>
        </div>
      </td>
      <td class="price">${product.price} ETB/${product.unit}</td>
      <td>
        <div class="quantity">
          <span class="stock">${product.stock} ${product.unit}</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${stockPercentage}%"></div>
          </div>
        </div>
      </td>
      <td>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </td>
      <td class="actions">
        <button class="action-btn edit" data-id="${product._id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn delete" data-id="${product._id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });

  addProductEventListeners();
}

function addProductEventListeners() {
  console.log("🎯 Adding product event listeners...");

  document.querySelectorAll(".action-btn.edit").forEach((btn) => {
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll(".action-btn.edit").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const productId = this.getAttribute("data-id");
      console.log(" Edit button clicked:", productId);

      if (productId) {
        editProduct(productId);
      } else {
        console.error(" No product ID found on edit button");
        showNotification("Cannot edit: Product ID missing", "error");
      }
    });
  });

  document.querySelectorAll(".action-btn.delete").forEach((btn) => {
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll(".action-btn.delete").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const productId = this.getAttribute("data-id");
      console.log(" Delete button clicked:", productId);

      if (productId) {
        deleteProduct(productId);
      } else {
        console.error(" No product ID found on delete button");
        showNotification("Cannot delete: Product ID missing", "error");
      }
    });
  });
}
function showAddProductModal() {
  currentProductForEdit = null;
  const modal = document.getElementById("productModal");
  const modalBody = modal.querySelector(".modal-body");

  console.log("📝 Showing add product modal");

  modalBody.innerHTML = `
    <form id="productForm" enctype="multipart/form-data">
      <div class="form-group">
        <label for="productName">Product Name *</label>
        <input type="text" id="productName" name="name" required placeholder="e.g., Organic Tomatoes">
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="productPrice">Price (ETB) *</label>
          <input type="number" id="productPrice" name="price" required placeholder="e.g., 25" min="1" step="0.01">
        </div>
        <div class="form-group">
          <label for="productUnit">Unit *</label>
          <select id="productUnit" name="unit" required>
            <option value="kg">kg</option>
            <option value="g">gram</option>
            <option value="piece">piece</option>
            <option value="bundle">bundle</option>
            <option value="liter">liter</option>
            <option value="dozen">dozen</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label for="productCategory">Category *</label>
        <select id="productCategory" name="category" required>
          <option value="vegetable">Vegetable</option>
          <option value="fruit">Fruit</option>
          <option value="grain">Grain</option>
          <option value="spice">Spice</option>
          <option value="dairy">Dairy</option>
          <option value="meat">Meat</option>
          <option value="poultry">Poultry</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="productStock">Initial Stock *</label>
        <input type="number" id="productStock" name="stock" required placeholder="e.g., 100" min="0">
      </div>
      
      <div class="form-group">
        <label for="productDescription">Description</label>
        <textarea id="productDescription" name="description" rows="3" placeholder="Describe your product..."></textarea>
      </div>
      
      <!-- ===== IMAGE UPLOAD SECTION ===== -->
      <div class="form-group">
        <label for="productImage">Product Image *</label>
        <div class="image-upload-options">
          <!-- Option 1: Upload from computer -->
          <div class="upload-option">
            <input type="file" 
                   id="productImageFile" 
                   name="image" 
                   accept="image/*" 
                   class="file-input"
                   onchange="previewImage(this)">
            <label for="productImageFile" class="upload-btn">
              <i class="fas fa-upload"></i> Upload Photo
            </label>
          </div>
          
          <!-- Option 2: Take picture (webcam) -->
          <div class="upload-option">
            <button type="button" class="camera-btn" onclick="openCamera()">
              <i class="fas fa-camera"></i> Take Photo
            </button>
          </div>
          
          <!-- Option 3: Use image URL -->
          <div class="upload-option">
            <button type="button" class="url-btn" onclick="toggleImageUrl()">
              <i class="fas fa-link"></i> Use Image URL
            </button>
          </div>
        </div>
        
        <!-- URL input (hidden by default) -->
        <div id="imageUrlContainer" style="display: none; margin-top: 10px;">
          <input type="text" 
                 id="productImageUrl" 
                 placeholder="https://example.com/image.jpg"
                 onchange="previewImageFromUrl(this.value)">
          <small>Enter direct image URL</small>
        </div>
        
        <!-- Image Preview -->
        <div id="imagePreviewContainer" style="margin-top: 15px; display: none;">
          <p><strong>Preview:</strong></p>
          <img id="imagePreview" 
               style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">
          <button type="button" onclick="clearImage()" 
                  style="margin-left: 10px; padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 4px;">
            <i class="fas fa-times"></i> Remove
          </button>
        </div>
        
        <small class="form-text text-muted">
          Upload a clear photo of your product. Max size: 5MB. Supported formats: JPG, PNG, JPEG
        </small>
      </div>
      <!-- ===== END IMAGE UPLOAD SECTION ===== -->
      
      <div class="form-actions">
        <button type="button" class="btn-cancel" onclick="closeProductModal()">Cancel</button>
        <button type="submit" class="btn-submit">Add Product</button>
      </div>
    </form>
  `;

  modal.style.display = "flex";

  const form = document.getElementById("productForm");
  form.addEventListener("submit", handleProductSubmit);
}

function showEditProductModal(product) {
  console.log("📝 Showing edit modal for:", product.name);

  currentProductForEdit = product;
  const modal = document.getElementById("productModal");
  const modalBody = modal.querySelector(".modal-body");

  modalBody.innerHTML = `
    <form id="productForm" enctype="multipart/form-data">
      <input type="hidden" name="id" value="${product._id}">
      
      <div class="form-group">
        <label for="productName">Product Name *</label>
        <input type="text" id="productName" name="name" value="${
          product.name
        }" required>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="productPrice">Price (ETB) *</label>
          <input type="number" id="productPrice" name="price" value="${
            product.price
          }" required min="1" step="0.01">
        </div>
        <div class="form-group">
          <label for="productUnit">Unit *</label>
          <select id="productUnit" name="unit" required>
            <option value="kg" ${
              product.unit === "kg" ? "selected" : ""
            }>kg</option>
            <option value="g" ${
              product.unit === "g" ? "selected" : ""
            }>gram</option>
            <option value="piece" ${
              product.unit === "piece" ? "selected" : ""
            }>piece</option>
            <option value="bundle" ${
              product.unit === "bundle" ? "selected" : ""
            }>bundle</option>
            <option value="liter" ${
              product.unit === "liter" ? "selected" : ""
            }>liter</option>
            <option value="dozen" ${
              product.unit === "dozen" ? "selected" : ""
            }>dozen</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label for="productCategory">Category *</label>
        <select id="productCategory" name="category" required>
          <option value="vegetable" ${
            product.category === "vegetable" ? "selected" : ""
          }>Vegetable</option>
          <option value="fruit" ${
            product.category === "fruit" ? "selected" : ""
          }>Fruit</option>
          <option value="grain" ${
            product.category === "grain" ? "selected" : ""
          }>Grain</option>
          <option value="spice" ${
            product.category === "spice" ? "selected" : ""
          }>Spice</option>
          <option value="dairy" ${
            product.category === "dairy" ? "selected" : ""
          }>Dairy</option>
          <option value="meat" ${
            product.category === "meat" ? "selected" : ""
          }>Meat</option>
          <option value="poultry" ${
            product.category === "poultry" ? "selected" : ""
          }>Poultry</option>
          <option value="other" ${
            product.category === "other" ? "selected" : ""
          }>Other</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="productStock">Stock *</label>
        <input type="number" id="productStock" name="stock" value="${
          product.stock
        }" required min="0">
      </div>
      
      <div class="form-group">
        <label for="productDescription">Description</label>
        <textarea id="productDescription" name="description" rows="3">${
          product.description || ""
        }</textarea>
      </div>
      
      <!-- ===== IMAGE UPLOAD SECTION ===== -->
      <div class="form-group">
        <label for="productImage">Product Image</label>
        
        <!-- Show current image -->
        <div style="margin-bottom: 15px;">
          <p><strong>Current Image:</strong></p>
          <img src="${product.image || "../pictures/default-product.jpg"}" 
               style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;"
               onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'">
        </div>
        
        <p><strong>Update Image:</strong></p>
        <div class="image-upload-options">
          <!-- Option 1: Upload from computer -->
          <div class="upload-option">
            <input type="file" 
                   id="productImageFile" 
                   name="image" 
                   accept="image/*" 
                   class="file-input"
                   onchange="previewImage(this)">
            <label for="productImageFile" class="upload-btn">
              <i class="fas fa-upload"></i> Upload New Photo
            </label>
          </div>
          
          <!-- Option 2: Take picture (webcam) -->
          <div class="upload-option">
            <button type="button" class="camera-btn" onclick="openCamera()">
              <i class="fas fa-camera"></i> Take Photo
            </button>
          </div>
          
          <!-- Option 3: Use image URL -->
          <div class="upload-option">
            <button type="button" class="url-btn" onclick="toggleImageUrl()">
              <i class="fas fa-link"></i> Use Image URL
            </button>
          </div>
        </div>
        
        <!-- URL input (hidden by default) -->
        <div id="imageUrlContainer" style="display: none; margin-top: 10px;">
          <input type="text" 
                 id="productImageUrl" 
                 placeholder="https://example.com/image.jpg"
                 onchange="previewImageFromUrl(this.value)">
          <small>Enter direct image URL</small>
        </div>
        
        <!-- New Image Preview -->
        <div id="imagePreviewContainer" style="margin-top: 15px; display: none;">
          <p><strong>New Image Preview:</strong></p>
          <img id="imagePreview" 
               style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">
          <button type="button" onclick="clearImage()" 
                  style="margin-left: 10px; padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 4px;">
            <i class="fas fa-times"></i> Remove
          </button>
        </div>
        
        <small class="form-text text-muted">
          Leave empty to keep current image. Max size: 5MB. Supported formats: JPG, PNG, JPEG
        </small>
      </div>
      <!-- ===== END IMAGE UPLOAD SECTION ===== -->
      
      <div class="form-actions">
        <button type="button" class="btn-cancel" onclick="closeProductModal()">Cancel</button>
        <button type="submit" class="btn-submit">Update Product</button>
      </div>
    </form>
  `;

  modal.style.display = "flex";

  const form = document.getElementById("productForm");
  form.addEventListener("submit", handleProductSubmit);
}

function previewImage(input) {
  const preview = document.getElementById("imagePreview");
  const previewContainer = document.getElementById("imagePreviewContainer");

  if (input.files && input.files[0]) {
    const reader = new FileReader();

    reader.onload = function (e) {
      preview.src = e.target.result;
      previewContainer.style.display = "block";
    };

    reader.readAsDataURL(input.files[0]);
  }
}

function previewImageFromUrl(url) {
  const preview = document.getElementById("imagePreview");
  const previewContainer = document.getElementById("imagePreviewContainer");

  if (url && url.startsWith("http")) {
    preview.src = url;
    previewContainer.style.display = "block";
  }
}

function toggleImageUrl() {
  const urlContainer = document.getElementById("imageUrlContainer");
  const fileInput = document.getElementById("productImageFile");

  if (urlContainer.style.display === "none") {
    urlContainer.style.display = "block";
    fileInput.disabled = true;
  } else {
    urlContainer.style.display = "none";
    fileInput.disabled = false;
  }
}

function clearImage() {
  const fileInput = document.getElementById("productImageFile");
  const urlInput = document.getElementById("productImageUrl");
  const previewContainer = document.getElementById("imagePreviewContainer");

  if (fileInput) fileInput.value = "";
  if (urlInput) urlInput.value = "";
  previewContainer.style.display = "none";
}

function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Camera access is not supported in your browser.");
    return;
  }

  const cameraModal = document.createElement("div");
  cameraModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;

  cameraModal.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 10px; max-width: 90%;">
      <h3 style="margin-top: 0;">Take a Photo</h3>
      <video id="cameraVideo" autoplay style="width: 100%; max-width: 500px; border-radius: 5px;"></video>
      <canvas id="cameraCanvas" style="display: none;"></canvas>
      
      <div style="margin-top: 15px; display: flex; gap: 10px;">
        <button id="captureBtn" style="padding: 10px 20px; background: #2f8f44; color: white; border: none; border-radius: 5px;">
          <i class="fas fa-camera"></i> Capture
        </button>
        <button id="retakeBtn" style="padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 5px; display: none;">
          <i class="fas fa-redo"></i> Retake
        </button>
        <button id="usePhotoBtn" style="padding: 10px 20px; background: #2196f3; color: white; border: none; border-radius: 5px; display: none;">
          <i class="fas fa-check"></i> Use Photo
        </button>
        <button id="closeCamera" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px;">
          <i class="fas fa-times"></i> Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(cameraModal);

  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("cameraCanvas");
  let stream = null;

  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(function (mediaStream) {
      stream = mediaStream;
      video.srcObject = stream;
    })
    .catch(function (err) {
      console.error("Camera error:", err);
      alert("Could not access camera: " + err.message);
      cameraModal.remove();
    });

  document.getElementById("captureBtn").addEventListener("click", function () {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    video.style.display = "none";
    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/jpeg");
    img.style.width = "100%";
    img.style.maxWidth = "500px";
    img.style.borderRadius = "5px";
    video.parentNode.insertBefore(img, video);

    this.style.display = "none";
    document.getElementById("retakeBtn").style.display = "block";
    document.getElementById("usePhotoBtn").style.display = "block";

    // Use photo
    document
      .getElementById("usePhotoBtn")
      .addEventListener("click", function () {
        const preview = document.getElementById("imagePreview");
        const previewContainer = document.getElementById(
          "imagePreviewContainer",
        );

        preview.src = canvas.toDataURL("image/jpeg");
        previewContainer.style.display = "block";

        // Store image data in a hidden field
        let imageDataInput = document.getElementById("imageData");
        if (!imageDataInput) {
          imageDataInput = document.createElement("input");
          imageDataInput.type = "hidden";
          imageDataInput.id = "imageData";
          imageDataInput.name = "imageData";
          document.getElementById("productForm").appendChild(imageDataInput);
        }
        imageDataInput.value = canvas.toDataURL("image/jpeg");

        cameraModal.remove();
      });
  });

  document.getElementById("retakeBtn").addEventListener("click", function () {
    const img = video.parentNode.querySelector("img");
    if (img) img.remove();

    video.style.display = "block";
    this.style.display = "none";
    document.getElementById("usePhotoBtn").style.display = "none";
    document.getElementById("captureBtn").style.display = "block";

    // Restart camera
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(function (mediaStream) {
        stream = mediaStream;
        video.srcObject = stream;
      })
      .catch(console.error);
  });

  // Close camera
  document.getElementById("closeCamera").addEventListener("click", function () {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    cameraModal.remove();
  });
}
async function handleProductSubmit(e) {
  e.preventDefault();
  console.log("📤 Submitting product form...");

  const form = e.target;

  // Build FormData manually to avoid duplicates
  const formData = new FormData();

  // Add all text fields from the form
  const name = form.querySelector('[name="name"]').value;
  const price = form.querySelector('[name="price"]').value;
  const unit = form.querySelector('[name="unit"]').value;
  const category = form.querySelector('[name="category"]').value;
  const stock = form.querySelector('[name="stock"]').value;
  const description = form.querySelector('[name="description"]')?.value || "";

  formData.append("name", name);
  formData.append("price", price);
  formData.append("unit", unit);
  formData.append("category", category);
  formData.append("stock", stock);
  formData.append("description", description);

  const imageFileInput = document.getElementById("productImageFile");
  const imageUrlInput = document.getElementById("productImageUrl");
  const imageDataInput = document.getElementById("imageData");

  if (imageFileInput && imageFileInput.files[0]) {
    formData.append("image", imageFileInput.files[0]);
    console.log("📷 Sending image file:", imageFileInput.files[0].name);
  } else if (imageUrlInput && imageUrlInput.value.trim()) {
    formData.append("imageUrl", imageUrlInput.value.trim());
    console.log("🔗 Sending image URL:", imageUrlInput.value);
  } else if (imageDataInput && imageDataInput.value) {
    formData.append("imageData", imageDataInput.value);
    console.log("📸 Sending image data (base64)");
  }

  console.log("📦 FormData contents:");
  for (let [key, value] of formData.entries()) {
    console.log(key, value instanceof File ? `File: ${value.name}` : value);
  }

  const productName = formData.get("name");
  const productPrice = formData.get("price");
  const productUnit = formData.get("unit");
  const productCategory = formData.get("category");
  const productStock = formData.get("stock");

  if (
    !productName ||
    !productPrice ||
    !productUnit ||
    !productCategory ||
    !productStock
  ) {
    showNotification("Please fill all required fields (*)", "error");
    return;
  }

  try {
    let response, url, method;

    if (currentProductForEdit) {
      // Update existing product
      url = `${API_BASE_URL}/products/${currentProductForEdit._id}`;
      method = "PUT";
      console.log("🔄 Updating product:", url);
    } else {
      // Create new product
      url = `${API_BASE_URL}/products`;
      method = "POST";
      console.log("🆕 Creating product:", url);
    }

    const token = localStorage.getItem("token");
    response = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    console.log("📦 Server response status:", response.status);

    const data = await response.json();
    console.log("📦 Server response data:", data);

    if (response.ok && data.success) {
      showNotification(
        currentProductForEdit
          ? "Product updated successfully!"
          : "Product added successfully!",
        "success",
      );
      closeProductModal();
      await loadDashboardData();
    } else {
      showNotification(data.message || "Operation failed", "error");
    }
  } catch (error) {
    console.error("❌ Error saving product:", error);
    showNotification("Failed to save product. Please try again.", "error");
  }
}

async function deleteProduct(productId) {
  console.log("🗑️ Deleting product:", productId);

  if (!confirm("Are you sure you want to delete this product?")) return;

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    console.log("🗑️ Delete response status:", response.status);

    const data = await response.json();
    console.log("🗑️ Delete response data:", data);

    if (response.ok && data.success) {
      showNotification("Product deleted successfully!", "success");
      await loadDashboardData(); // Refresh everything
    } else {
      showNotification(data.message || "Failed to delete product", "error");
    }
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    showNotification("Failed to delete product.", "error");
  }
}

function closeProductModal() {
  const modal = document.getElementById("productModal");
  modal.style.display = "none";
  currentProductForEdit = null;
  console.log("📦 Modal closed");
}
function updateStats(stats) {
  if (!stats) {
    stats = {
      totalSales: 12500,
      activeOrders: 8,
      activeProducts: 12,
      averageRating: 0.0, // Default to 0 if not provided
      numberOfRatings: 0,
    };
  }

  const statCards = document.querySelectorAll(".stat-card");

  if (statCards[0]) {
    statCards[0].querySelector("h3").textContent = `${(
      stats.totalSales || 12500
    ).toLocaleString()} ETB`;
  }
  if (statCards[1]) {
    statCards[1].querySelector("h3").textContent = stats.activeOrders || 8;
  }
  if (statCards[2]) {
    statCards[2].querySelector("h3").textContent = stats.activeProducts || 12;
  }
  if (statCards[3]) {
    statCards[3].querySelector("h3").textContent =
      stats.averageRating.toFixed(1);
    statCards[3].querySelector("p").textContent =
      `Average Rating (${stats.numberOfRatings} reviews)`;

    const trendSpan = statCards[3].querySelector(".stat-trend");
    if (trendSpan) {
      const currentRating = stats.averageRating;
      const previousRating = 0;
      const difference = (currentRating - previousRating).toFixed(1);

      if (difference > 0) {
        trendSpan.textContent = `+${difference}`;
        trendSpan.className = "stat-trend up";
      } else if (difference < 0) {
        trendSpan.textContent = difference;
        trendSpan.className = "stat-trend down";
      } else {
        trendSpan.textContent = "0.0";
        trendSpan.className = "stat-trend";
      }
    }
  }
}
function renderRecentOrders(orders) {
  const ordersList = document.querySelector(".orders-list");
  if (!ordersList) return;

  ordersList.innerHTML = "";

  if (!orders || orders.length === 0) {
    ordersList.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #666;">
        <i class="fas fa-shopping-cart" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
        <p>No recent orders</p>
      </div>
    `;
    return;
  }

  orders.forEach((order) => {
    const orderItem = document.createElement("div");
    orderItem.className = "order-item";

    let statusClass = "pending";
    if (order.status === "processing") statusClass = "processing";
    else if (order.status === "shipped") statusClass = "shipped";
    else if (order.status === "delivered") statusClass = "delivered";
    else if (order.status === "cancelled") statusClass = "out";

    const orderNumber =
      order.orderNumber || `ORD-${order._id?.slice(-4) || "0000"}`;
    const itemsCount = order.itemCount || order.items?.length || 0;
    const buyerName =
      order.buyer?.fullName ||
      order.customerName ||
      order.buyerName ||
      "Unknown Buyer";

    const shippingAddress = order.shippingAddress;
    const addressText = shippingAddress
      ? `${shippingAddress.address || ""}${shippingAddress.city ? `, ${shippingAddress.city}` : ""}`.trim()
      : "No address provided";

    const paymentMethod = order.paymentMethod || "cash_on_delivery";
    const formattedPaymentMethod = paymentMethod
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const notes = order.notes || "No notes";

    let itemsHtml = "";
    if (order.items && order.items.length > 0) {
      console.log("Order items data:", order.items);
      itemsHtml = order.items
        .map((item, index) => {
          const productName =
            item.productDetails?.name ||
            item.name ||
            item.productName ||
            item.product?.name ||
            item.title ||
            item.itemName ||
            `Item ${index + 1}`;

          console.log(`Item ${index}:`, item);

          return `
          <div class="order-item-detail">
            <span class="item-name">${productName}</span>
            <span class="item-quantity">${item.quantity || 0} ${item.unit || "pcs"}</span>
            <span class="item-price">${item.price || 0} ETB</span>
          </div>
        `;
        })
        .join("");
    }

    orderItem.innerHTML = `
      <div class="order-info">
        <h4>${orderNumber}</h4>
        <p><strong>Buyer:</strong> ${buyerName}</p>
        <p><strong>Address:</strong> ${addressText}</p>
        <p><strong>Payment:</strong> ${formattedPaymentMethod}</p>
        ${notes !== "No notes" ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}

        <p>${itemsCount} items • ${formatTimeAgo(order.createdAt)}</p>
          ${
            itemsHtml
              ? `
          <div class="order-items-preview">
            <strong>Items:</strong>
            ${itemsHtml}
          </div>
        `
              : ""
          }
      </div>
      <div class="order-status">
        <span class="status ${statusClass}">${order.status}</span>
        <span class="amount">${order.totalPrice || 0} ETB</span>
      </div>
      <div class="order-actions">
        <button class="action-btn view-order-btn" data-id="${order._id}">View</button>
        ${order.status !== "delivered" ? `<button class="action-btn mark-delivered-btn" data-id="${order._id}">Mark Delivered</button>` : ""}
      </div>
    `;
    ordersList.appendChild(orderItem);
  });

  document.querySelectorAll(".view-order-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      viewOrderDetails(e.currentTarget.dataset.id);
    });
  });

  document.querySelectorAll(".mark-delivered-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      markAsDelivered(e.currentTarget.dataset.id);
    });
  });
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function showNotification(message, type = "info") {
  const existingNotifications = document.querySelectorAll(
    ".notification-toast",
  );
  existingNotifications.forEach((notification) => notification.remove());

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

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.closeProductModal = closeProductModal;
window.showAddProductModal = showAddProductModal;
window.logout = logout;

async function showProfileModal() {
  console.log(" Opening profile manager...");

  const modal = document.getElementById("profileModal");
  const modalBody = document.getElementById("profileModalBody");

  modalBody.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-green);"></i>
      <p style="margin-top: 1rem;">Loading profile...</p>
    </div>
  `;

  modal.style.display = "flex";

  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to load profile");
    }

    const data = await response.json();
    const user = data.user;

    modalBody.innerHTML = `
      <form id="profileForm">
        <div class="form-group">
          <label for="fullName">Full Name *</label>
          <input type="text" id="fullName" name="fullName" value="${
            user.fullName || ""
          }" required>
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" value="${
            user.email || ""
          }" disabled 
                 style="background-color: #f5f5f5; cursor: not-allowed;">
          <small style="color: #666; display: block; margin-top: 0.25rem;">Email cannot be changed</small>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="phone">Phone Number *</label>
            <input type="tel" id="phone" name="phone" value="${
              user.phone || ""
            }" required>
          </div>
          <div class="form-group">
            <label for="city">City *</label>
            <input type="text" id="city" name="city" value="${
              user.city || ""
            }" required>
          </div>
        </div>
        
        <div class="form-group">
          <label for="address">Address</label>
          <textarea id="address" name="address" rows="2" placeholder="Street address, area...">${
            user.address || ""
          }</textarea>
        </div>
        
        <div class="form-group">
          <label for="farmName">Farm Name *</label>
          <input type="text" id="farmName" name="farmName" value="${
            user.farmName || ""
          }" required>
        </div>
        
        <div class="form-group">
          <label for="farmLocation">Farm Location</label>
          <input type="text" id="farmLocation" name="farmLocation" value="${
            user.farmLocation || ""
          }" 
                 placeholder="e.g., Sebeta, Oromia">
        </div>
        
        <div class="form-actions" style="margin-top: 1.5rem;">
          <button type="button" class="btn-cancel" onclick="closeProfileModal()">Cancel</button>
          <button type="submit" class="btn-submit">Save Changes</button>
        </div>
      </form>
    `;

    const form = document.getElementById("profileForm");
    form.addEventListener("submit", handleProfileSubmit);
  } catch (error) {
    console.error("❌ Error loading profile:", error);
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--danger);">
        <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
        <p>Failed to load profile. Please try again.</p>
        <button class="btn-submit" onclick="showProfileModal()" style="margin-top: 1rem;">Retry</button>
      </div>
    `;
  }
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  modal.style.display = "none";
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  console.log(" Saving profile changes...");

  const form = e.target;
  const formData = {
    fullName: form.querySelector("#fullName").value.trim(),
    phone: form.querySelector("#phone").value.trim(),
    city: form.querySelector("#city").value.trim(),
    address: form.querySelector("#address").value.trim(),
    farmName: form.querySelector("#farmName").value.trim(),
    farmLocation: form.querySelector("#farmLocation").value.trim(),
  };

  if (
    !formData.fullName ||
    !formData.phone ||
    !formData.city ||
    !formData.farmName
  ) {
    showNotification("Please fill all required fields (*)", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const updatedUser = {
        ...JSON.parse(localStorage.getItem("user")),
        ...data.user,
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      updateUserInfoInSidebar(updatedUser);

      showNotification("Profile updated successfully! 🎉", "success");
      closeProfileModal();
    } else {
      showNotification(data.message || "Failed to update profile", "error");
    }
  } catch (error) {
    console.error(" Error updating profile:", error);
    showNotification("Failed to update profile. Please try again.", "error");
  }
}

function updateUserInfoInSidebar(user) {
  const nameElement = document.querySelector(".user-details h4");
  const farmElement = document.querySelector(".user-details p");
  const avatarImg = document.querySelector(".user-avatar img");
  const userMenuImg = document.querySelector(".user-menu img");

  if (nameElement) nameElement.textContent = user.fullName || "Farmer";
  if (farmElement) farmElement.textContent = user.farmName || "Farm";

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    user.fullName || "Farmer",
  )}&background=2f8f44&color=fff`;
  if (avatarImg) avatarImg.src = avatarUrl;
  if (userMenuImg) userMenuImg.src = avatarUrl;
}

function loadCustomerRatings() {
  const ratings = JSON.parse(localStorage.getItem("customerRatings") || "[]");

  return ratings.filter((rating) => {
    return true;
  });
}

function calculateAverageRating(ratings) {
  if (ratings.length === 0) return 0;

  const sum = ratings.reduce((total, rating) => total + rating.rating, 0);
  return (sum / ratings.length).toFixed(1);
}

function updateFarmerRating() {
  const ratings = loadCustomerRatings();
  const averageRating = calculateAverageRating(ratings);

  const avgRatingElements = document.querySelectorAll(".stat-info h3");
  avgRatingElements.forEach((el) => {
    if (el.textContent.includes("4.2")) {
      el.textContent = averageRating;
      const trendSpan = el.closest(".stat-card").querySelector(".stat-trend");
      if (trendSpan) {
        const currentRating = parseFloat(averageRating);
        const previousRating = 4.2;
        const difference = (currentRating - previousRating).toFixed(1);

        if (difference > 0) {
          trendSpan.textContent = `+${difference}`;
          trendSpan.className = "stat-trend up";
        } else if (difference < 0) {
          trendSpan.textContent = difference;
          trendSpan.className = "stat-trend down";
        } else {
          trendSpan.textContent = "0.0";
        }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("delivered")) {
    localStorage.setItem("orderDelivered", "true");
  }

  updateFarmerRating();

  const ratingsBtn = document.getElementById("ratingsBtn");
  if (ratingsBtn) {
    ratingsBtn.addEventListener("click", function (e) {
      e.preventDefault();
      showRatingsPage();
    });
  }
});
function markAsDelivered(orderId) {
  if (
    !confirm(`Are you sure you want to mark order ${orderId} as delivered?`)
  ) {
    return;
  }

  const orders = JSON.parse(localStorage.getItem("farmerOrders") || "[]");
  const orderIndex = orders.findIndex((order) => order.id === orderId);

  if (orderIndex > -1) {
    orders[orderIndex].status = "delivered";
    orders[orderIndex].deliveredAt = new Date().toISOString();
    orders[orderIndex].updatedAt = new Date().toISOString();

    localStorage.setItem("farmerOrders", JSON.stringify(orders));
    storeDeliveryNotification(orderId, orders[orderIndex]);
    updateOrderStatusInUI(orderId, "delivered");
    showNotification(
      `Order ${orderId} marked as delivered! Buyer has been notified.`,
      "success",
    );
    updateStatsAfterDelivery();
  } else {
    const newOrder = {
      id: orderId,
      status: "delivered",
      deliveredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      items: [],
      amount: 0,
    };

    orders.push(newOrder);
    localStorage.setItem("farmerOrders", JSON.stringify(orders));
    updateOrderStatusInUI(orderId, "delivered");
    showNotification(`Order ${orderId} marked as delivered!`, "success");
  }
}

function storeDeliveryNotification(orderId, orderDetails) {
  const notifications = JSON.parse(
    localStorage.getItem("buyerNotifications") || "[]",
  );

  const notification = {
    id: "notif_" + Date.now(),
    type: "delivery",
    orderId: orderId,
    message: `Your order ${orderId} has been delivered! Please rate your experience.`,
    timestamp: new Date().toISOString(),
    read: false,
    farmerName: "Abebe Tadesse",
    redirectUrl: `success.html?order=${orderId}&delivered=true`,
  };

  notifications.push(notification);
  localStorage.setItem("buyerNotifications", JSON.stringify(notifications));

  const deliveredOrders = JSON.parse(
    localStorage.getItem("deliveredOrders") || "[]",
  );
  if (!deliveredOrders.includes(orderId)) {
    deliveredOrders.push(orderId);
    localStorage.setItem("deliveredOrders", JSON.stringify(deliveredOrders));
  }
}

function updateOrderStatusInUI(orderId, status) {
  const orderItems = document.querySelectorAll(".order-item");

  orderItems.forEach((item) => {
    const orderHeader = item.querySelector(".order-info h4");
    if (orderHeader && orderHeader.textContent.includes(orderId)) {
      const statusBadge = item.querySelector(".order-status .status");
      if (statusBadge) {
        statusBadge.textContent =
          status.charAt(0).toUpperCase() + status.slice(1);
        statusBadge.className = "status " + status;
      }

      const deliverBtn = item.querySelector(".btn-success");
      if (deliverBtn) {
        deliverBtn.disabled = true;
        deliverBtn.innerHTML = '<i class="fas fa-check"></i> Delivered';
        deliverBtn.classList.remove("btn-success");
        deliverBtn.classList.add("btn-secondary");
      }

      const timestamp = item.querySelector(".order-info p");
      if (timestamp) {
        const now = new Date();
        timestamp.textContent =
          timestamp.textContent.split("•")[0] + "• Delivered now";
      }
    }
  });
}

function viewOrderDetails(orderId) {
  const orders = JSON.parse(localStorage.getItem("farmerOrders") || "[]");
  const order = orders.find((o) => o.id === orderId);

  if (order) {
    alert(
      `Order Details for ${orderId}:\nStatus: ${order.status}\nAmount: ${
        order.amount
      } ETB\nItems: ${order.items ? order.items.length : "N/A"}`,
    );
  } else {
    alert(
      `Order ${orderId} details:\nStatus: Unknown\nPlease mark as delivered to track this order.`,
    );
  }
}

async function markAsDelivered(orderId) {
  if (
    !confirm(`Are you sure you want to mark order ${orderId} as delivered?`)
  ) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: "delivered" }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showNotification(
        `Order ${orderId} marked as delivered! Buyer has been notified.`,
        "success",
      );
      await loadDashboardData();
    } else {
      showNotification(
        data.message || "Failed to update order status",
        "error",
      );
    }
  } catch (error) {
    console.error("Error marking order as delivered:", error);
    showNotification("Failed to mark order as delivered.", "error");
  }
}

async function viewOrderDetails(orderId) {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const order = data.order;
      alert(
        `Order Details for ${order.orderNumber}:\nStatus: ${order.status}\nTotal: ${order.totalPrice} ETB\nItems: ${order.items.length}`,
      );
    } else {
      showNotification(data.message || "Failed to load order details", "error");
    }
  } catch (error) {
    console.error("Error viewing order details:", error);
    showNotification("Failed to load order details.", "error");
  }
}

function updateStatsAfterDelivery() {
  loadDashboardData();
}

window.markAsDelivered = markAsDelivered;
window.viewOrderDetails = viewOrderDetails;
async function loadFarmerFeedback() {
  const container = document.getElementById("farmerReviewsList");
  if (!container) return;

  container.innerHTML = `<p style="color:#666; text-align:center; margin: 1rem 0;">Loading reviews…</p>`;

  try {
    const response = await fetch(`${API_BASE_URL}/products/farmer/feedback`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Failed to fetch farmer feedback:", response.status, text);
      container.innerHTML = `<p style="color:#f44336; text-align:center;">Failed to load reviews.</p>`;
      return;
    }

    const data = await response.json();

    const reviews = data.reviews || [];

    if (reviews.length === 0) {
      container.innerHTML = `<p style="color:#666; text-align:center; margin: 1rem 0;">No reviews yet.</p>`;
      return;
    }

    const html = reviews
      .slice(0, 8)
      .map((r) => {
        const reviewer = (r.user && r.user.fullName) || "Anonymous";
        const productName = (r.product && r.product.name) || "Product";
        const rating = r.rating || 0;
        const comment = r.comment || "";
        const date = new Date(
          r.createdAt || r.updatedAt || Date.now(),
        ).toLocaleDateString();

        const stars = Array.from({ length: 5 })
          .map((_, i) =>
            i < rating
              ? '<i class="fas fa-star" style="color:#ffc107"></i>'
              : '<i class="far fa-star" style="color:#ddd"></i>',
          )
          .join(" ");

        return `
          <div class="review-item" style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
              <div style="display:flex; gap:10px; align-items:center;">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(reviewer)}&background=2f8f44&color=fff" alt="${reviewer}" style="width:40px;height:40px;border-radius:50%;">
                <div>
                  <strong style="display:block;">${reviewer}</strong>
                  <small style="color:#666;">${productName} • ${date}</small>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.9rem">${stars}</div>
                <div style="font-weight:600; color:#2f8f44; margin-top:6px;">${rating.toFixed ? rating.toFixed(1) : rating}</div>
              </div>
            </div>
            ${comment ? `<p style="margin:10px 0 0 50px; color:#333;">${escapeHtml(comment)}</p>` : ""}
          </div>
        `;
      })
      .join("");

    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading farmer feedback:", err);
    container.innerHTML = `<p style="color:#f44336; text-align:center;">Error loading reviews.</p>`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

