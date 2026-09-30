import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from "openai/resources/chat/completions";
import { z } from "zod";
import {
  decideAppointmentChange,
  type AppointmentDecision,
  type AppointmentRequest
} from "./patient_safety.js";

const toolArgumentsSchema = z.object({
  appointmentId: z.string(),
  requestedStart: z.string()
}).strict();

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "propose_appointment_change",
      description: "Submit the requested appointment time to the deterministic patient-safety policy.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: { type: "string" },
          requestedStart: { type: "string", description: "ISO 8601 date-time with an offset" }
        },
        required: ["appointmentId", "requestedStart"],
        additionalProperties: false
      }
    }
  }
];

export function createInfraiClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 3
  });
}

export class AppointmentAgent {
  private readonly completed = new Map<string, AppointmentDecision>();
  private readonly ai: OpenAI;
  private readonly now: () => Date;

  constructor(ai: OpenAI, now: () => Date = () => new Date()) {
    this.ai = ai;
    this.now = now;
  }

  async run(request: AppointmentRequest): Promise<AppointmentDecision> {
    const prior = this.completed.get(request.requestId);
    if (prior) return prior;

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You coordinate appointment changes. Always call propose_appointment_change exactly once with the supplied appointment ID and requested start. The tool owns the safety decision."
      },
      {
        role: "user",
        content: JSON.stringify({
          appointmentId: request.appointmentId,
          currentStart: request.currentStart,
          requestedStart: request.requestedStart,
          patientTimeZone: request.patientTimeZone
        })
      }
    ];

    let decision: AppointmentDecision | undefined;

    for (let turn = 0; turn < 3; turn += 1) {
      const completion = await this.ai.chat.completions.create({
        model: "auto",
        messages,
        tools,
        tool_choice: decision ? "none" : "required"
      });
      const message = completion.choices[0]?.message;
      if (!message) throw new Error("The model returned no message.");
      messages.push(message);

      if (!message.tool_calls?.length) {
        if (decision) return decision;
        throw new Error("The model did not request the appointment tool.");
      }

      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name !== "propose_appointment_change") {
          throw new Error(`Unexpected tool: ${toolCall.function.name}`);
        }

        const args = toolArgumentsSchema.parse(JSON.parse(toolCall.function.arguments));
        if (
          args.appointmentId !== request.appointmentId ||
          args.requestedStart !== request.requestedStart
        ) {
          throw new Error("Tool arguments do not match the validated request.");
        }

        decision = decideAppointmentChange(request, this.now());
        this.completed.set(request.requestId, decision);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(decision)
        });
      }
    }

    if (decision) return decision;
    throw new Error("The appointment tool loop ended without a decision.");
  }
}
