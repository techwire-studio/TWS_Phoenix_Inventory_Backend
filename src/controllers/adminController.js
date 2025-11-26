import prisma from '../config/db.js';
import { auth } from '../config/firebase.js';
import { sendAdminSignupInvitation } from '../utils/mailer.js';


export const createAdmin = async (req, res) => {
    try {
        const { email, name, username } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const existingByMail = await prisma.admin.findUnique({ where: { email } });
        if (existingByMail) {
            return res.status(409).json({ error: 'Admin with this email already exists locally.' });
        }
        const existingByUsername = await prisma.admin.findUnique({ where: { username } });
        if (existingByUsername) {
            return res.status(409).json({ error: 'Admin with this username already exists locally.' });
        }

        const newAdmin = await prisma.admin.create({
            data: {
                username,
                email,
                name,
                superAdmin: false
            },
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

        const frontendUrl = process.env.FRONTEND_ADMIN_URL;
        if (!frontendUrl) {
            console.warn("FRONTEND_ADMIN_URL environment variable not set. Cannot send sign-up invitation email.");
            return res.status(201).json({
                message: 'Admin record created locally. Sign-up invitation email NOT sent (FRONTEND_ADMIN_URL not configured).',
                admin: newAdmin
            });
        }

        try {
            await sendAdminSignupInvitation({
                recipientEmail: newAdmin.email,
                adminName: newAdmin.name,
                frontendUrl: frontendUrl
            });
            res.status(201).json({
                message: 'Admin record created locally and sign-up invitation email sent.',
                admin: newAdmin
            });
        } catch (emailError) {
            console.error("Failed to send sign-up invitation email, but admin record was created.", emailError);
            res.status(201).json({
                message: 'Admin record created locally. FAILED to send sign-up invitation email.',
                admin: newAdmin
            });
        }

    } catch (err) {
        console.error("Error creating local admin record:", err);
        if (err.code === 'P2002') {
            const field = err.meta?.target?.includes('email') ? 'email' : 'username';
            return res.status(409).json({ error: `Admin with this ${field} already exists.` });
        }
        res.status(500).json({ error: 'Failed to create admin record', details: err.message });
    }
};


export const deleteAdmin = async (req, res) => {
    try {
        const idParam = req.params.id;
        const requestingAdminId = req.admin?.id;

        if (!idParam) {
            return res.status(400).json({ error: 'Admin ID parameter is required.' });
        }
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid Admin ID format.' });
        }
        if (requestingAdminId && id === requestingAdminId) {
            return res.status(403).json({ error: 'Admins cannot delete their own account.' });
        }

        const adminToDelete = await prisma.admin.findUnique({
            where: { id: id },
            select: { firebaseUid: true, email: true }
        });

        if (!adminToDelete) {
            return res.status(404).json({ error: 'Admin not found in local database.' });
        }

        if (adminToDelete.firebaseUid) {
            try {
                await auth.deleteUser(adminToDelete.firebaseUid);
                console.log(`Successfully deleted Firebase user: UID ${adminToDelete.firebaseUid}, Email: ${adminToDelete.email}`);
            } catch (firebaseError) {
                console.error(`Failed to delete Firebase user ${adminToDelete.firebaseUid} (Email: ${adminToDelete.email}):`, firebaseError.code, firebaseError.message);
                if (firebaseError.code !== 'auth/user-not-found') {
                    console.warn("Proceeding with local database deletion despite Firebase deletion error.");
                }
            }
        } else {
            console.warn(`Admin ID ${id} (Email: ${adminToDelete.email}) has no associated Firebase UID. Skipping Firebase deletion step.`);
        }
        await prisma.admin.delete({
            where: { id: id }
        });

        res.status(200).json({ message: 'Admin deleted successfully from local DB and Firebase (if applicable).' });

    } catch (err) {
        console.error("Error during admin deletion process:", err);
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Admin not found during final delete operation.' });
        }
        res.status(500).json({ error: 'Failed to delete admin', details: err.message });
    }
};


export const getAllAdmins = async (req, res) => {
    try {
        const admins = await prisma.admin.findMany({
            where: {
                superAdmin: false
            },
            select: {
                id: true,
                firebaseUid: true,
                username: true,
                email: true,
                name: true,
                createdAt: true,
                superAdmin: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(admins);
    } catch (err) {
        console.error("Error fetching admins:", err);
        res.status(500).json({ error: 'Failed to fetch admins', details: err.message });
    }
};