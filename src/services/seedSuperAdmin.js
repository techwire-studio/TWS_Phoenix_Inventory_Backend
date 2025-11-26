import prisma from "../config/db.js";
import "dotenv/config";

const seedSuperAdmin = async () => {
    const username = process.env.USER_NAME;
    const email = process.env.EMAIL;
    const name = process.env.NAME;
    if (!username || !email || !name) {
        console.error(
            "USER_NAME, EMAIL, and NAME must be provided in environment variables for seeding Super Admin."
        );
        process.exit(1);
    }

    // Check if a SuperAdmin record already exists (by email or username)
    const existingSuperAdmin = await prisma.admin.findFirst({
        where: {
            OR: [{ email: email }, { username: username }],
            superAdmin: true
        }
    });

    if (existingSuperAdmin) {
        console.log(
            `Super Admin already exists locally with email [${email}] or username [${username}]. Skipping seed.`
        );
        process.exit(0);
    }

    await prisma.admin.create({
        data: {
            username,
            name,
            email,
            superAdmin: true
        }
    });

    console.log(`Super Admin record created locally for email: ${email}.`);
    console.log(
        `IMPORTANT: Please ensure this user Signs Up via the Firebase frontend using the email ${email} to activate the account.`
    );
    process.exit(0);
};

seedSuperAdmin().catch((error) => {
    console.error("Error seeding Super Admin local record:", error);
    process.exit(1);
});
