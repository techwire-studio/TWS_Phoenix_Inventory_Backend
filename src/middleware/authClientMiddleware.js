import { auth } from '../config/firebase.js';

export const authenticateClient = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized: No token provided or invalid format." });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: "Unauthorized: Token missing after Bearer." });
    }

    try {
        // Verify the token using the Firebase Admin SDK
        const decodedToken = await auth.verifyIdToken(idToken);

        // Attach the entire decoded token to the request object.
        // This will give our controllers access to the client's UID, email, etc.
        req.client = decodedToken;

        next(); // The token is valid, proceed to the next function (the controller)

    } catch (error) {
        console.error("Error verifying Firebase ID token for client:", error.code, error.message);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "Unauthorized: Token has expired." });
        }
        if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: "Unauthorized: Invalid token." });
        }
        return res.status(500).json({ error: "Internal Server Error: Could not verify authentication." });
    }
};