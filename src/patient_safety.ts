import { z } from "zod";

export const appointmentRequestSchema = z.object({
  requestId: z.string().min(1).max(100),
  patientId: z.string().min(1).max(100),
  appointmentId: z.string().min(1).max(100),
  currentStart: z.string().datetime({ offset: true }),
  requestedStart: z.string().datetime({ offset: true }),
  patientTimeZone: z.string().min(1).max(100),
  channel: z.enum(["sms", "email"]),
  consentToNotify: z.boolean()
}).strict();

export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;

export type AppointmentDecision =
  | {
      status: "rescheduled";
      appointmentId: string;
      newStart: string;
      notification: { channel: "sms" | "email"; message: string } | null;
    }
  | {
      status: "manual_review";
      appointmentId: string;
      reason: "past_requested_time" | "short_notice";
      notification: null;
    };

const SHORT_NOTICE_MS = 24 * 60 * 60 * 1000;

export function decideAppointmentChange(
  request: AppointmentRequest,
  now: Date
): AppointmentDecision {
  const requestedTime = new Date(request.requestedStart).getTime();
  const noticeMs = requestedTime - now.getTime();

  if (noticeMs <= 0) {
    return {
      status: "manual_review",
      appointmentId: request.appointmentId,
      reason: "past_requested_time",
      notification: null
    };
  }

  if (noticeMs < SHORT_NOTICE_MS) {
    return {
      status: "manual_review",
      appointmentId: request.appointmentId,
      reason: "short_notice",
      notification: null
    };
  }

  const notification = request.consentToNotify
    ? {
        channel: request.channel,
        message: `Appointment ${request.appointmentId} moved to ${request.requestedStart} (${request.patientTimeZone}).`
      }
    : null;

  return {
    status: "rescheduled",
    appointmentId: request.appointmentId,
    newStart: request.requestedStart,
    notification
  };
}
