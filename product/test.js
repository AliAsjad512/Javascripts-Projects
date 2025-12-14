const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 5000;
const JWT_SECRET = "your_jwt_secret_key";

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage
const users = [];
const wardrobes = {};

// Predefined clothing categories
const predefinedCategories = [
  "Shirts",
  "Pants",
  "Jackets",
  "Coats",
  "Dresses",
  "Shoes",
  "Accessories",
  "Undergarments",
  "Sportswear",
  "Formal Wear",
];

// Seasons
const seasons = ["Spring", "Summer", "Fall", "Winter", "All Season"];

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Routes

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password required" });
    }

    // Check if user exists
    const existingUser = users.find((u) => u.username === username);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: users.length + 1,
      username,
      password: hashedPassword,
    };

    users.push(user);

    // Initialize empty wardrobe for user
    wardrobes[user.id] = {
      categories: [],
      clothes: {},
    };

    const token = jwt.sign({ id: user.id, username }, JWT_SECRET);

    res.status(201).json({
      token,
      user: { id: user.id, username },
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password required" });
    }

    // Find user
    const user = users.find((u) => u.username === username);
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username }, JWT_SECRET);

    res.json({
      token,
      user: { id: user.id, username },
      message: "Login successful",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get predefined categories
app.get("/api/categories", authenticateToken, (req, res) => {
  res.json({ categories: predefinedCategories });
});

// Get user's wardrobe categories
app.get("/api/wardrobe/categories", authenticateToken, (req, res) => {
  const userWardrobe = wardrobes[req.user.id] || {
    categories: [],
    clothes: {},
  };
  res.json({ categories: userWardrobe.categories });
});

// Add category to wardrobe
app.post("/api/wardrobe/categories", authenticateToken, (req, res) => {
  const { category } = req.body;

  if (!category) {
    return res.status(400).json({ message: "Category is required" });
  }

  if (!wardrobes[req.user.id]) {
    wardrobes[req.user.id] = { categories: [], clothes: {} };
  }

  const userWardrobe = wardrobes[req.user.id];

  if (!userWardrobe.categories.includes(category)) {
    userWardrobe.categories.push(category);
    userWardrobe.clothes[category] = [];
  }

  res.json({
    message: "Category added successfully",
    categories: userWardrobe.categories,
  });
});

// Get clothes in a category
app.get("/api/wardrobe/clothes/:category", authenticateToken, (req, res) => {
  const { category } = req.params;
  const { season } = req.query;

  const userWardrobe = wardrobes[req.user.id] || {
    categories: [],
    clothes: {},
  };
  let clothes = userWardrobe.clothes[category] || [];

  // Filter by season if provided
  if (season && season !== "all") {
    clothes = clothes.filter(
      (cloth) =>
        cloth.season.toLowerCase() === season.toLowerCase() ||
        cloth.season.toLowerCase() === "all season"
    );
  }

  res.json({ clothes });
});

// Add cloth to category
app.post("/api/wardrobe/clothes", authenticateToken, (req, res) => {
  const { category, name, image, color, season } = req.body;

  if (!category || !name || !color || !season) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!wardrobes[req.user.id]) {
    wardrobes[req.user.id] = { categories: [], clothes: {} };
  }

  const userWardrobe = wardrobes[req.user.id];

  if (!userWardrobe.clothes[category]) {
    userWardrobe.clothes[category] = [];
  }

  const newCloth = {
    id: Date.now(), // Simple ID generation
    name,
    image: image || "",
    color,
    season,
  };

  userWardrobe.clothes[category].push(newCloth);

  res.status(201).json({
    message: "Cloth added successfully",
    cloth: newCloth,
  });
});

// Update cloth
app.put("/api/wardrobe/clothes/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { category, name, image, color, season } = req.body;

  const userWardrobe = wardrobes[req.user.id];
  if (!userWardrobe) {
    return res.status(404).json({ message: "Wardrobe not found" });
  }

  // Find and update cloth
  for (let cat in userWardrobe.clothes) {
    const clothIndex = userWardrobe.clothes[cat].findIndex((c) => c.id == id);
    if (clothIndex !== -1) {
      userWardrobe.clothes[cat][clothIndex] = {
        id: parseInt(id),
        name,
        image: image || "",
        color,
        season,
      };

      // If category changed, move the cloth
      if (cat !== category) {
        const cloth = userWardrobe.clothes[cat].splice(clothIndex, 1)[0];
        if (!userWardrobe.clothes[category]) {
          userWardrobe.clothes[category] = [];
        }
        userWardrobe.clothes[category].push(cloth);
      }

      return res.json({
        message: "Cloth updated successfully",
        cloth: userWardrobe.clothes[category || cat].find((c) => c.id == id),
      });
    }
  }

  res.status(404).json({ message: "Cloth not found" });
});

// Delete cloth
app.delete("/api/wardrobe/clothes/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  const userWardrobe = wardrobes[req.user.id];
  if (!userWardrobe) {
    return res.status(404).json({ message: "Wardrobe not found" });
  }

  // Find and delete cloth
  for (let category in userWardrobe.clothes) {
    const clothIndex = userWardrobe.clothes[category].findIndex(
      (c) => c.id == id
    );
    if (clothIndex !== -1) {
      userWardrobe.clothes[category].splice(clothIndex, 1);
      return res.json({ message: "Cloth deleted successfully" });
    }
  }

  res.status(404).json({ message: "Cloth not found" });
});

// Get seasons
app.get("/api/seasons", authenticateToken, (req, res) => {
  res.json({ seasons });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
