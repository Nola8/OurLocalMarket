const mongoose = require("mongoose");
require("dotenv").config();

async function fixReviewIndex() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/localmarket",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );

    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("reviews");

    try {
      await collection.dropIndex("order_1_product_1_user_1");
      console.log("Dropped old composite index");
    } catch (error) {
      console.log("Old composite index not found or already dropped");
    }

    const indexes = await collection.indexes();
    const productUserIndex = indexes.find(
      (index) => index.name === "product_1_user_1",
    );

    if (!productUserIndex) {
      await collection.createIndex({ product: 1, user: 1 }, { unique: true });
      console.log("Created product_1_user_1 unique index");
    } else {
      console.log("product_1_user_1 index already exists");
    }

    console.log("Review indexes fixed successfully");

    const currentIndexes = await collection.indexes();
    console.log(
      "Current indexes:",
      currentIndexes.map((idx) => idx.name),
    );
  } catch (error) {
    console.error("Error fixing review indexes:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

fixReviewIndex();
