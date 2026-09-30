import assert from "node:assert/strict";
import test from "node:test";
import { decideAppointmentChange, type AppointmentRequest } from "../src/patient_safety.js";

const baseRequest: AppointmentRequest = {
  requestId: "change-test-001",
  patientId: "patient-1",
  appointmentId: "appointment-1",
  currentStart: "2030-06-18T09:00:00Z",
  requestedStart: "2030-06-20T14:30:00Z",
  patientTimeZone: "UTC",
  channel: "sms",
  consentToNotify: true
};

test("short-notice changes go to manual review without a patient notification", () => {
  const decision = decideAppointmentChange(
    Object.assign({}, baseRequest, { requestedStart: "2030-06-18T20:00:00Z" }),
    new Date("2030-06-18T08:00:00Z")
  );

  assert.deepEqual(decision, {
    status: "manual_review",
    appointmentId: "appointment-1",
    reason: "short_notice",
    notification: null
  });
});

test("a reschedule suppresses outreach when the patient has not consented", () => {
  const decision = decideAppointmentChange(
    Object.assign({}, baseRequest, { consentToNotify: false }),
    new Date("2030-06-18T08:00:00Z")
  );

  assert.equal(decision.status, "rescheduled");
  assert.equal(decision.notification, null);
});
