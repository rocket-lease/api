import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from '../../domain/providers/email.provider';
import { Voucher } from '@rocket-lease/contracts';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      this.logger.warn('SMTP_USER o SMTP_PASS no configurados. Saltando envío de mail real.');
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  async sendVoucherEmail(to: string, voucher: Voucher): Promise<void> {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) {
      this.logger.warn('SMTP_USER o SMTP_PASS no configurados. Saltando envío de mail real.');
      return;
    }

    const verifyUrl = `https://rocketlease.qzz.io/reservations/voucher/verify/${voucher.voucherToken}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #1e3a8a; text-align: center;">¡Tu Reserva está Confirmada!</h2>
        <p>Hola,</p>
        <p>Gracias por reservar con <strong>Rocket Lease</strong>. Aquí tienes tu voucher digital con el código QR para retirar tu vehículo.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Detalles de la Reserva</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0; color: #6b7280;">Vehículo:</td>
              <td style="padding: 5px 0; font-weight: bold; color: #1f2937;">${voucher.vehicle.brand} ${voucher.vehicle.model} (${voucher.vehicle.year})</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #6b7280;">Fechas:</td>
              <td style="padding: 5px 0; font-weight: bold; color: #1f2937;">${new Date(voucher.startAt).toLocaleDateString()} - ${new Date(voucher.endAt).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #6b7280;">Importe Pagado:</td>
              <td style="padding: 5px 0; font-weight: bold; color: #1f2937;">$${(voucher.totalCents / 100).toFixed(2)} ${voucher.currency}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="font-weight: bold; color: #1f2937; margin-bottom: 10px;">Presenta este código QR al retirar el vehículo:</p>
          <img src="${qrUrl}" alt="Voucher QR Code" style="border: 4px solid #1e3a8a; border-radius: 10px; padding: 10px; background: white;" />
          <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">Token: ${voucher.voucherToken}</p>
        </div>

        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          Este es un correo automático de Rocket Lease. Por favor, no respondas a este mensaje.
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: `"Rocket Lease" <${user}>`,
        to,
        subject: 'Tu Voucher Digital de Reserva - Rocket Lease',
        html: htmlContent,
      });

      this.logger.log(`Voucher enviado exitosamente por SMTP a ${to}`);
    } catch (error) {
      this.logger.error(`Fallo al enviar el voucher por SMTP a ${to}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
