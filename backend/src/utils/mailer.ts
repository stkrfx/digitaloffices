import nodemailer from 'nodemailer';

// 1. Setup the Transporter
// (In production, use process.env.SMTP_HOST, etc.)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or 'SMTP' for other providers
  auth: {
    user: process.env.SMTP_EMAIL, // e.g. "noreply@digitaloffices.com"
    pass: process.env.SMTP_PASSWORD // App Password, NOT your real password
  }
});

// 2. The Verification Email Function
export async function sendVerificationEmail(email: string, token: string) {
  // In a real app, this URL comes from an Env Var (e.g., https://digitaloffices.com)
  // This points to your FRONTEND page, which will then call the Backend API
  const baseUrl = process.env.API_URL || 'http://localhost:3000'; // Define API_URL in .env later
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: '"Digital Offices Security" <noreply@digitaloffices.com>',
    to: email,
    subject: 'Verify your Digital Offices Account',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Digital Offices!</h2>
        <p>Please click the button below to verify your email address and activate your account.</p>
        <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none;border-radius: 5px;">Verify Email</a>
        <p>Or paste this link: ${verificationLink}</p>
        <p>This link expires in 24 hours.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}