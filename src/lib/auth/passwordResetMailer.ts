/**
 * Optional email delivery for password reset.
 * Leave this unset until Supabase or another mail service is connected.
 * The login screen must not claim a message was sent while this is empty.
 */
export type PasswordResetMailer = {
  sendResetLink(input: { to: string; resetUrl: string }): Promise<void>;
};

let mailer: PasswordResetMailer | null = null;

export function setPasswordResetMailer(next: PasswordResetMailer | null) {
  mailer = next;
}

export function getPasswordResetMailer() {
  return mailer;
}
