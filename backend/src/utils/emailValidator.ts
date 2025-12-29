import validator from 'email-validator';
import disposableDomains from 'disposable-email-domains';
import dns from 'dns/promises';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export async function validateEmailStrict(email: string): Promise<ValidationResult> {
  // 1. LAYER ONE: Syntax Check
  if (!email || !validator.validate(email)) {
    return { isValid: false, reason: 'Invalid email format' };
  }

  const domain = email.split('@')[1].toLowerCase();

  // 2. LAYER TWO: Disposable Blocklist (The "System" you asked for)
  // This checks against 50,000+ known fake providers
  if (disposableDomains.includes(domain)) {
    return { isValid: false, reason: 'Disposable emails are not allowed' };
  }

  // 3. LAYER THREE: DNS MX Record Check (The "Gold Standard")
  // We ask the internet: "Does this domain have a mail server?"
  // This catches "new" fake domains that aren't in the list yet.
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { isValid: false, reason: 'Domain cannot receive emails' };
    }
  } catch (error) {
    // If DNS lookup fails, the domain doesn't exist
    return { isValid: false, reason: 'Invalid domain' };
  }

  return { isValid: true };
}