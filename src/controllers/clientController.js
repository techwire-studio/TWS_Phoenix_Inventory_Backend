import prisma from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = "2h"; // Client token expiry time
const COOKIE_EXPIRES_IN_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const CLIENT_COOKIE_NAME = "client_token";

/**
 * Fetches a list of all clients. (For Admins)
 */
export const getAllClients = async (req, res) => {
    try {
        const clients = await prisma.client.findMany({
            orderBy: {
                createdAt: "desc"
            }
        });
        res.status(200).json(clients);
    } catch (error) {
        console.error("Failed to fetch clients:", error);
        res.status(500).json({ error: "Could not fetch clients." });
    }
};

export const logoutClient = (req, res) => {
    res.clearCookie(CLIENT_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: "/"
    });
    res.status(200).json({ message: "Logout successful." });
};

// --- Verify Client Token ---
export const verifyClientToken = (req, res) => {
    const token = req.cookies?.[CLIENT_COOKIE_NAME];
    console.log("Client token verification attempt with token:", token);

    if (!token) {
        // No token doesn't necessarily mean an error for this specific endpoint,
        // it just means user is not authenticated. Frontend can use this info.
        return res.status(200).json({ isAuthenticated: false, client: null });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const clientPayload = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            phoneNumber: decoded.phoneNumber,
            role: decoded.role
            // Add other non-sensitive fields from token if you put them there
        };

        res.status(200).json({ isAuthenticated: true, client: clientPayload });
    } catch (error) {
        console.error("Client token verification error:", error.message);
        // If token is invalid (expired, tampered), clear the cookie
        res.clearCookie(CLIENT_COOKIE_NAME, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            path: "/"
        });
        if (error.name === "TokenExpiredError") {
            return res.status(200).json({
                isAuthenticated: false,
                error: "Token expired.",
                client: null
            });
        }
        return res
            .status(200)
            .json({ isAuthenticated: false, error: "Invalid token.", client: null });
    }
};

// --- Client Signup ---
export const signupClient = async (req, res) => {
    const { email, password, name, phoneNumber } = req.body;

    try {
        const existingClient = await prisma.client.findUnique({
            where: {
                email: email.toLowerCase()
            }
        });
        if (existingClient) {
            return res
                .status(409)
                .json({ error: "Client with this email already exists and is verified." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newClient = await prisma.client.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name: name,
                phoneNumber: phoneNumber
            }
        });

        res.status(201).json({
            message: "Client created successfully.",
            clientId: newClient.id
        });
    } catch (error) {
        console.error("Error checking existing client:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

export const loginClient = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    try {
        const client = await prisma.client.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (!client) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const passwordMatch = await bcrypt.compare(password, client.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const tokenPayload = {
            id: client.id,
            email: client.email,
            name: client.name,
            phoneNumber: client.phoneNumber
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: TOKEN_EXPIRES_IN
        });

        res.cookie(CLIENT_COOKIE_NAME, token, {
            httpOnly: true,
            secure: true,
            sameSite: "None"
            // maxAge: COOKIE_EXPIRES_IN_MS,
        });

        const { password: _, ...clientData } = client;
        res.status(200).json({
            message: "Login successful.",
            client: clientData
            // token: token // Optionally return token
        });
    } catch (error) {
        console.error("Client login error:", error);
        res.status(500).json({ error: "Authentication failed.", details: error.message });
    }
};
