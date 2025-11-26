import { auth } from '../config/firebase.js'; 
import prisma from '../config/db.js'; 
export const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("Authorization header missing or invalid format");
        return res.status(401).json({ error: "Unauthorized: No token provided or invalid format." });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
         console.log("Bearer token is empty");
         return res.status(401).json({ error: "Unauthorized: Token missing after Bearer." });
    }

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email;
        if (!firebaseUid) {
            console.error("Token verified but Firebase UID missing in decoded token.");
            return res.status(401).json({ error: "Unauthorized: Invalid token payload." });
        }

        let admin = await prisma.admin.findUnique({
            where: { firebaseUid: firebaseUid },
             select: {
                 id: true,
                 firebaseUid: true,
                 username: true,
                 email: true,
                 name: true,
                 superAdmin: true,
                 createdAt: true
             }
        });


        if (!admin && email) {
            console.log(`Admin not found by UID ${firebaseUid}, trying lookup by email ${email}`);
            admin = await prisma.admin.findUnique({
                where: { email: email },
                select: {
                    id: true,
                    firebaseUid: true,
                    username: true,
                    email: true,
                    name: true,
                    superAdmin: true,
                    createdAt: true
                }
            });
            if (admin && !admin.firebaseUid) {
                console.log(`Found admin by email, linking Firebase UID ${firebaseUid} to local admin ID ${admin.id}`);
                admin = await prisma.admin.update({
                    where: { id: admin.id },
                    data: { firebaseUid: firebaseUid },
                     select: { 
                         id: true,
                         firebaseUid: true,
                         username: true,
                         email: true,
                         name: true,
                         superAdmin: true,
                         createdAt: true
                     }
                });
            } else if (admin && admin.firebaseUid && admin.firebaseUid !== firebaseUid) {
                // Edge case: Email exists but is linked to a DIFFERENT Firebase UID. This indicates a problem.
                console.error(`CRITICAL: Email ${email} in DB is linked to UID ${admin.firebaseUid}, but token has UID ${firebaseUid}.`);
                 return res.status(409).json({ error: "Conflict: Account email mismatch." });
            }
        }
        if (!admin) {
             console.warn(`Firebase user ${firebaseUid} (${email || 'no email'}) authenticated successfully, but no corresponding Admin record found in local database.`);
             return res.status(403).json({ error: "Forbidden: Your account is authenticated but not registered as an admin." });
        }

        req.admin = admin;
        next();

    } catch (error) {
        console.error("Error verifying Firebase ID token:", error.code, error.message);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "Unauthorized: Token has expired." });
        }
        if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked') {
             return res.status(401).json({ error: "Unauthorized: Invalid token." });
        }
        return res.status(500).json({ error: "Internal Server Error: Could not verify authentication." });
    }
};

export const authenticateSuperAdmin = (req, res, next) => {
    if (!req.admin || !req.admin.superAdmin) {
        return res.status(403).json({ error: "Forbidden: Super Admin rights required." });
    }
    next();
};