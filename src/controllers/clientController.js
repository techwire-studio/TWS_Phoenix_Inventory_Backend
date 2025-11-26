import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';

/**
 * Creates a new client record in the database.
 * This is called right after a user signs up on the frontend with Firebase.
 */
export const registerClient = async (req, res) => {
    // The user's Firebase UID and email are from the token, which we trust.
    const { uid, email } = req.client;
    // Other details like name and phone number come from the request body.
    const { name, phoneNumber } = req.body;

    if (!uid || !email) {
        return res.status(400).json({ error: 'Invalid token. UID and email are missing.' });
    }

    try {
        const newClient = await prisma.client.create({
            data: {
                id: uid, // Use Firebase UID as our primary key
                email: email,
                name: name,
                phoneNumber: phoneNumber,
            },
        });
        res.status(201).json(newClient);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // This can happen if the user somehow calls register twice.
            // We can just return the existing user.
            const existingClient = await prisma.client.findUnique({ where: { id: uid } });
            return res.status(200).json(existingClient);
        }
        console.error('Failed to register client:', error);
        res.status(500).json({ error: 'Could not register client.' });
    }
};

/**
 * Fetches a list of all clients. (For Admins)
 */
export const getAllClients = async (req, res) => {
    try {
        const clients = await prisma.client.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.status(200).json(clients);
    } catch (error) {
        console.error('Failed to fetch clients:', error);
        res.status(500).json({ error: 'Could not fetch clients.' });
    }
};