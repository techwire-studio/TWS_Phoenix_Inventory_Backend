export const verifyToken = (req, res) => {
    res.status(200).json({
        message: "Token is valid and user is authorized.",
        id: req.admin.id,                   // Local DB Admin ID
        firebaseUid: req.admin.firebaseUid, // Firebase User ID
        username: req.admin.username,       // Local username
        email: req.admin.email,             // User's email
        name: req.admin.name,               // User's name
        role: req.admin.superAdmin ? "Super Admin" : "Admin" // User's role
    });
};