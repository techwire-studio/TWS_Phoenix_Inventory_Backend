import express from "express";
import productRoutes from "./routes/productRoutes.js";
import dotenv from "dotenv";
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import formRoutes from "./routes/formRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";

dotenv.config();
const app = express();

const allowedOrigins = [
    "https://example.vercel.app",
    "http://localhost:5173",
    "https://example.vercel.app",
    "*"
];

// app.use(cors({
//   origin: function (origin, callback) {
//     // `!origin` allows requests from origins like `null` (file://), mobile apps, or curl.
//     if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
// }));
app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json());
app.use(cookieParser());
// Routes
app.get("/", (req, res) => {
    res.send("API is running...");
});
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", superAdminRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/clients", clientRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
