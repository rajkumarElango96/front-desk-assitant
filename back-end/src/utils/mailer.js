'use strict'

/**
 * Amara — Email Utility
 *
 * Sends appointment confirmation + reminder emails via nodemailer + AWS SES (SMTP).
 *
 * Required .env vars:
 *   SMTP_HOST   — SES regional endpoint   e.g. email-smtp.us-east-1.amazonaws.com
 *   SMTP_USER   — SES SMTP username       (IAM access key style, from SES console)
 *   SMTP_PASS   — SES SMTP password       (from SES console — shown only once)
 *   SMTP_FROM   — verified sender address e.g. "Amara <you@gmail.com>"
 *                 Must be a verified identity in AWS SES
 */

const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   587,
  secure: false,           // TLS via STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

function formatAppointmentDetails(appointment) {
  const { patient, provider, slot, appointmentDate, appointmentType, appointmentReason } = appointment

  return {
    providerName:  `Dr. ${provider.providerFirstName} ${provider.providerLastName}`,
    specialty:     provider.specialty.charAt(0) + provider.specialty.slice(1).toLowerCase(),
    date:          new Date(appointmentDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'UTC' }),
    startTime:     new Date(slot.slotStartTime).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'UTC' }),
    endTime:       new Date(slot.slotEndTime).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'UTC' }),
    apptTypeLabel: appointmentType === 'TELE' ? 'Telehealth (Video)' : 'In-Person',
    patientName:   `${patient.firstName} ${patient.lastName}`,
    appointmentReason,
    patientEmail:  patient.email,
  }
}

/**
 * sendConfirmationEmail
 * Sends a booking confirmation to the patient's email address.
 *
 * @param {object} appointment — created appointment with patient, provider, slot included
 */
async function sendConfirmationEmail(appointment) {
  const { providerName, specialty, date, startTime, endTime, apptTypeLabel, patientName, appointmentReason, patientEmail } =
    formatAppointmentDetails(appointment)

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:12px;">
      <div style="background:linear-gradient(135deg,#2563eb,#06b6d4);padding:24px;border-radius:8px;text-align:center;margin-bottom:24px;">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Appointment Confirmed</h1>
        <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">Amara</p>
      </div>

      <p style="color:#334155;font-size:15px;">Hi ${patientName},</p>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Your appointment has been confirmed. Here are the details:
      </p>

      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
          <tr><td style="padding:8px 0;color:#94a3b8;width:140px;">Provider</td>     <td style="padding:8px 0;font-weight:600;">${providerName} · ${specialty}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Date</td>                     <td style="padding:8px 0;font-weight:600;">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Time</td>                     <td style="padding:8px 0;font-weight:600;">${startTime} – ${endTime}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Type</td>                     <td style="padding:8px 0;font-weight:600;">${apptTypeLabel}</td></tr>
          ${appointmentReason ? `<tr><td style="padding:8px 0;color:#94a3b8;">Reason</td><td style="padding:8px 0;">${appointmentReason}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#64748b;font-size:13px;line-height:1.6;">
        If you need to reschedule or cancel, please reply to this email or contact us directly.
      </p>

      <div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;text-align:center;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Amara · Powered by AI</p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"Amara" <${process.env.SMTP_USER}>`,
    to:      patientEmail,
    subject: `Appointment Confirmed — ${providerName} on ${date}`,
    html,
  })

  console.log(`[MAILER] Confirmation sent to ${patientEmail}`)
}

/**
 * sendReminderEmail
 * Sends a pre-appointment reminder, separate from the instant booking confirmation —
 * fired by the reminder cron job (see src/jobs/reminder.js) roughly 24h before the visit.
 *
 * @param {object} appointment — appointment with patient, provider, slot included
 */
async function sendReminderEmail(appointment) {
  const { providerName, specialty, date, startTime, endTime, apptTypeLabel, patientName, appointmentReason, patientEmail } =
    formatAppointmentDetails(appointment)

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:12px;">
      <div style="background:linear-gradient(135deg,#2563eb,#06b6d4);padding:24px;border-radius:8px;text-align:center;margin-bottom:24px;">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Appointment Reminder</h1>
        <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">Amara</p>
      </div>

      <p style="color:#334155;font-size:15px;">Hi ${patientName},</p>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        This is a reminder that you have an upcoming appointment:
      </p>

      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
          <tr><td style="padding:8px 0;color:#94a3b8;width:140px;">Provider</td>     <td style="padding:8px 0;font-weight:600;">${providerName} · ${specialty}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Date</td>                     <td style="padding:8px 0;font-weight:600;">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Time</td>                     <td style="padding:8px 0;font-weight:600;">${startTime} – ${endTime}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Type</td>                     <td style="padding:8px 0;font-weight:600;">${apptTypeLabel}</td></tr>
          ${appointmentReason ? `<tr><td style="padding:8px 0;color:#94a3b8;">Reason</td><td style="padding:8px 0;">${appointmentReason}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#64748b;font-size:13px;line-height:1.6;">
        If you need to reschedule or cancel, please reply to this email or contact us directly.
      </p>

      <div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;text-align:center;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Amara · Powered by AI</p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"Amara" <${process.env.SMTP_USER}>`,
    to:      patientEmail,
    subject: `Reminder: Appointment with ${providerName} on ${date}`,
    html,
  })

  console.log(`[MAILER] Reminder sent to ${patientEmail}`)
}

module.exports = { sendConfirmationEmail, sendReminderEmail }
