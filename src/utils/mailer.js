import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

export const sendOrderNotificationToAdmins = async ({ recipients, orderId, customerName }) => {
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        console.warn("No admin recipients provided for order notification.");
        return;
    }

    const mailOptions = {
        from: `"TechWire Order System" <${process.env.GMAIL_USER}>`,
        bcc: recipients, // Use BCC to send to all admins without revealing addresses
        subject: `New Order Placed - ID: ${orderId}`,
        html: `
            <h3>A new enquiry has been received on TechWire.</h3>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Placed By:</strong> ${customerName}</p>
            <p>Please log in to the admin panel to view the complete order details.</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(
            `Order notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`
        );
        return info;
    } catch (error) {
        console.error("Error sending order notification email to admins:", error);
    }
};

export const sendCareerApplicationNotification = async ({
    recipients,
    applicantName,
    applicantEmail,
    areaOfInterest,
    resumeFile
}) => {
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        console.warn("No admin recipients provided for career application notification.");
        return;
    }

    const attachments = [];
    if (resumeFile && resumeFile.buffer && resumeFile.originalname) {
        attachments.push({
            filename: resumeFile.originalname,
            content: resumeFile.buffer,
            contentType: resumeFile.mimetype
        });
    } else {
        console.warn(
            `Resume file object was invalid or missing for applicant ${applicantEmail}. Email sent without attachment.`
        );
    }

    const mailOptions = {
        from: `"TechWire Careers" <${process.env.GMAIL_USER}>`,
        bcc: recipients,
        subject: `New Job Application Received - ${applicantName}`,
        html: `
            <h3>A new job application has been submitted via the website.</h3>
            <p><strong>Applicant Name:</strong> ${applicantName}</p>
            <p><strong>Applicant Email:</strong> ${applicantEmail}</p>
            <p><strong>Area of Interest:</strong> ${areaOfInterest}</p>
            <p><strong>Resume:</strong> See attached file.</p>
            <p>Please review the application.</p>
        `,
        attachments: attachments
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(
            `Career application notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`
        );
        return info;
    } catch (error) {
        console.error("Error sending career application notification email:", error);
    }
};

export const sendContactInquiryNotification = async ({
    recipients,
    fullName,
    companyName,
    email,
    phone,
    productCategory,
    message
}) => {
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        console.warn("No admin recipients provided for contact inquiry notification.");
        return;
    }

    const mailOptions = {
        from: `"TechWire Website Contact" <${process.env.GMAIL_USER}>`,
        bcc: recipients,
        subject: `New Contact Inquiry from ${fullName}`,
        html: `
            <h3>A new inquiry has been submitted via the website contact form.</h3>
            <p><strong>Full Name:</strong> ${fullName}</p>
            ${companyName ? `<p><strong>Company Name:</strong> ${companyName}</p>` : ""}
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone Number:</strong> ${phone}</p>
            ${productCategory ? `<p><strong>Product Category:</strong> ${productCategory}</p>` : ""}
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
            <p>Please follow up as needed.</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(
            `Contact inquiry notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`
        );
        return info;
    } catch (error) {
        console.error("Error sending contact inquiry notification email:", error);
    }
};

// New function to send sign-up instructions to a newly created admin
export const sendAdminSignupInvitation = async ({ recipientEmail, adminName, frontendUrl }) => {
    if (!recipientEmail || !adminName || !frontendUrl) {
        console.error("Missing required information for sending admin sign-up invitation.");
        // Decide how to handle this - throw error, return false, etc.
        // For now, just log and return to avoid crashing the admin creation process.
        return;
    }

    const mailOptions = {
        from: `"TechWire Admin Team" <${process.env.GMAIL_USER}>`, // Customize sender name
        to: recipientEmail,
        subject: "Your Admin Account is Ready for Setup",
        html: `
            <h3>Hello ${adminName},</h3>
            <p>A local administrator record has been created for you for the TechWire/TechWire Admin Panel.</p>
            <p>To activate your account and set your password, please visit the admin panel website and complete the <strong>Sign Up</strong> process using your email address: <strong>${recipientEmail}</strong></p>
            <p><a href="${frontendUrl}" target="_blank">Go to Admin Panel Sign Up/Login</a></p>
            <p>During sign up, you will be asked to create your own password.</p>
            <p>If you did not expect this email, please ignore it.</p>
            <br/>
            <p>Best Regards,</p>
            <p>The Admin Team</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(
            `Admin sign-up invitation email sent successfully to ${recipientEmail}. Message ID: ${info.messageId}`
        );
        return info;
    } catch (error) {
        console.error(`Error sending admin sign-up invitation email to ${recipientEmail}:`, error);
    }
};

// Add this new function to src/utils/mailer.js

export const sendZipReportEmail = async ({ recipientEmail, reportUrl, originalZipName }) => {
    if (!recipientEmail || !reportUrl || !originalZipName) {
        console.error("Missing required information for sending ZIP report email.");
        return;
    }

    const mailOptions = {
        from: `"TechWire Bulk Uploader" <${process.env.GMAIL_USER}>`,
        to: recipientEmail,
        subject: `Report for your upload: ${originalZipName}`,
        html: `
            <h3>Hello,</h3>
            <p>The ZIP file you uploaded (<strong>${originalZipName}</strong>) has been processed successfully.</p>
            <p>You can download the detailed CSV report by clicking the link below:</p>
            <p><a href="${reportUrl}" target="_blank">Download Upload Report</a></p>
            <br/>
            <p>Best Regards,</p>
            <p>The Admin Team</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(
            `ZIP report notification email sent successfully to ${recipientEmail}. Message ID: ${info.messageId}`
        );
        return info;
    } catch (error) {
        console.error(`Error sending ZIP report email to ${recipientEmail}:`, error);
        throw error;
    }
};

// export const sendCareerApplicationNotification = async ({ recipients, applicantName, applicantEmail, areaOfInterest, resumeUrl }) => {
//     if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
//         console.warn("No admin recipients provided for career application notification.");
//         return;
//     }

//     const mailOptions = {
//         from: `"TechWire Careers" <${process.env.GMAIL_USER}>`,
//         bcc: recipients,
//         subject: `New Job Application Received - ${applicantName}`,
//         html: `
//             <h3>A new job application has been submitted via the website.</h3>
//             <p><strong>Applicant Name:</strong> ${applicantName}</p>
//             <p><strong>Applicant Email:</strong> ${applicantEmail}</p>
//             <p><strong>Area of Interest:</strong> ${areaOfInterest}</p>
//             <p><strong>Resume Link:</strong> <a href="${resumeUrl}" target="_blank">View Resume</a></p>
//             <p>Please review the application.</p>
//         `
//     };

//     try {
//         const info = await transporter.sendMail(mailOptions);
//         console.log(`Career application notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`);
//         return info;
//     } catch (error) {
//         console.error("Error sending career application notification email:", error);
//     }
// };
