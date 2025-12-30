import nodemailer from 'nodemailer';
import { getVerificationEmailHtml } from '../templates/verificationEmail';

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
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; // Define API_URL in .env later
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: '"Digital Offices Security" <noreply@digitaloffices.com>',
    to: email,
    subject: 'Verify your Digital Offices Account',
    html: getVerificationEmailHtml(verificationLink)
  };

  await transporter.sendMail(mailOptions);
}