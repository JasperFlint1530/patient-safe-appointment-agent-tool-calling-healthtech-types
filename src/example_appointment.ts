import { AppointmentAgent, createInfraiClient } from "./appointment_agent.js";
import { appointmentRequestSchema } from "./patient_safety.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example.");

const request = appointmentRequestSchema.parse({
  requestId: "change-demo-001",
  patientId: "patient-1042",
  appointmentId: "appointment-8831",
  currentStart: "2030-06-18T09:00:00-04:00",
  requestedStart: "2030-06-20T14:30:00-04:00",
  patientTimeZone: "America/New_York",
  channel: "sms",
  consentToNotify: true
});

const agent = new AppointmentAgent(createInfraiClient(apiKey));
console.log(JSON.stringify(await agent.run(request), null, 2));
