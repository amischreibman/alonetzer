// Optional outgoing email (password reset links). Skipped when SMTP is unset.
import { config } from "./config.js";

export interface Mailer {
  ready: boolean;
  send(to: string, subject: string, text: string): Promise<void>;
}

export async function createMailer(): Promise<Mailer> {
  const { host, port, user, pass, from } = config.smtp;
  if (!host) {
    return {
      ready: false,
      async send(to, subject, text) {
        console.log(`[mail:dry] to=${to} subject=${subject}\n${text}`);
      },
    };
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.default.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined });
  return {
    ready: true,
    async send(to, subject, text) {
      await transport.sendMail({ from, to, subject, text });
    },
  };
}
