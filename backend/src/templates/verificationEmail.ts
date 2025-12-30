export const getVerificationEmailHtml = (link: string) => `
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <h2>Welcome to Digital Offices!</h2>
  <p>Please click the button below to verify your email address and activate your account.</p>
  <a href="${link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none;border-radius: 5px;">Verify Email</a>
  <p>Or paste this link: ${link}</p>
  <p>This link expires in 24 hours.</p>
</div>
`;