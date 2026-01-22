const mongoose = require("mongoose");
require("dotenv").config();

async function cleanupIndexes() {
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

    const indexes = await collection.indexes();
    console.log("Current indexes before cleanup:");
    indexes.forEach((index) => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });

    const indexesToDrop = ["product_1_user_1_order_1"];

    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`Dropped conflicting index: ${indexName}`);
      } catch (error) {
        console.log(`Index ${indexName} not found or already dropped`);
      }
    }

    const desiredIndexes = [
      {
        key: { product: 1, user: 1 },
        options: { unique: true, name: "product_1_user_1" },
      },
      {
        key: { product: 1, rating: 1 },
        options: { name: "product_1_rating_1" },
      },
      { key: { user: 1 }, options: { name: "user_1" } },
      { key: { createdAt: -1 }, options: { name: "createdAt_-1" } },
      { key: { helpfulCount: -1 }, options: { name: "helpfulCount_-1" } },
    ];

    const finalIndexes = await collection.indexes();
    console.log("\nFinal indexes after cleanup:");
    finalIndexes.forEach((index) => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
  } catch (error) {
    console.error("Error cleaning up indexes:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

cleanupIndexes();
