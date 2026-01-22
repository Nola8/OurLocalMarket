const API_BASE_URL = "http://localhost:5000/api";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function loadRatingPage() {
  const avgEl = document.getElementById("averageRating");
  const totalReviewsEl = document.getElementById("totalReviews");
  const reviewsContainer = document.getElementById("reviewsContainer");
  const fiveStarCount = document.getElementById("fiveStarCount");
  const fourStarCount = document.getElementById("fourStarCount");
  const threeStarCount = document.getElementById("threeStarCount");
  const twoStarCount = document.getElementById("twoStarCount");
  const oneStarCount = document.getElementById("oneStarCount");

  if (!reviewsContainer) return;

  reviewsContainer.innerHTML = `<p style="text-align:center;color:#666">Loading reviews…</p>`;

  try {
    const res = await fetch(`${API_BASE_URL}/products/farmer/feedback`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to load feedback:", res.status, text);
      reviewsContainer.innerHTML = `<p style="text-align:center;color:#f44336">Failed to load reviews</p>`;
      return;
    }

    const data = await res.json();
    const reviews = data.reviews || [];
    const overallRating = data.overallRating || 0;
    const totalReviews = data.totalReviews || reviews.length;
    const ratingsByProduct = data.productRatings || [];

    if (avgEl)
      avgEl.textContent = overallRating.toFixed
        ? overallRating.toFixed(1)
        : overallRating;
    if (totalReviewsEl)
      totalReviewsEl.textContent = `Based on ${totalReviews} reviews`;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    });

    if (fiveStarCount) fiveStarCount.textContent = distribution[5] || 0;
    if (fourStarCount) fourStarCount.textContent = distribution[4] || 0;
    if (threeStarCount) threeStarCount.textContent = distribution[3] || 0;
    if (twoStarCount) twoStarCount.textContent = distribution[2] || 0;
    if (oneStarCount) oneStarCount.textContent = distribution[1] || 0;

    if (reviews.length === 0) {
      reviewsContainer.innerHTML = `<div class="empty-reviews"><i class="fas fa-box-open"></i><p>No reviews yet</p></div>`;
      return;
    }

    const html = reviews
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
        <div class="review-item">
          <div class="review-header" style="display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:12px">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(reviewer)}&background=2f8f44&color=fff" style="width:40px;height:40px;border-radius:50%">
              <div>
                <strong>${escapeHtml(reviewer)}</strong>
                <div style="font-size:12px;color:#666">${escapeHtml(productName)} • ${date}</div>
              </div>
            </div>
            <div style="text-align:right">
              <div class="stars">${stars}</div>
              <div style="font-weight:600;color:#2f8f44;margin-top:6px">${rating.toFixed ? rating.toFixed(1) : rating}</div>
            </div>
          </div>
          ${comment ? `<div class="review-content" style="margin-top:10px;color:#333">${escapeHtml(comment)}</div>` : ""}
        </div>
      `;
      })
      .join("");

    reviewsContainer.innerHTML = html;
  } catch (err) {
    console.error("Error loading farmer feedback:", err);
    reviewsContainer.innerHTML = `<p style="text-align:center;color:#f44336">Error loading reviews</p>`;
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

document.addEventListener("DOMContentLoaded", function () {
  loadRatingPage();
});
