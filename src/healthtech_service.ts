import { createServer, type ServerResponse } from "node:http";
import { OpenAI } from "openai";
import { ZodError } from "zod";
import { AppointmentAgent, createInfraiClient } from "./appointment_agent.js";
import { appointmentRequestSchema } from "./patient_safety.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

const agent = new AppointmentAgent(createInfraiClient(apiKey));
const port = Number(process.env.PORT ?? 3000);

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/appointment-changes") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = appointmentRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await agent.run(body);
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid appointment request" });
      return;
    }
    if (error instanceof OpenAI.APIError && error.status && error.status >= 400 && error.status < 500) {
      sendJson(response, error.status, { error: "AI request rejected" });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: "Appointment automation failed" });
  }
});

server.listen(port, () => {
  console.log(`Appointment service listening on http://localhost:${port}`);
});
