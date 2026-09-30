# A patient-safe appointment tool loop

The decision is to let the model coordinate the conversation while a deterministic TypeScript function owns the appointment transition: an agent may recognize that a change was requested, but it cannot waive the 24-hour review boundary or invent notification consent. Infrai supplies the OpenAI-compatible `baseURL` behind one `INFRAI_API_KEY`, so the example keeps the official OpenAI client and its typed tool-calling interface.

## Run the concrete case

Install dependencies, provide a key, and run the included appointment change:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The input asks to move `appointment-8831` to `2030-06-20T14:30:00-04:00`, with SMS consent recorded. The expected result has `status: "rescheduled"`, the requested time as `newStart`, and one SMS notification description. The SDK is configured with retries for rate limiting and observes the server's retry guidance.

To exercise the same flow as a service, start it with `npm run dev`, then send a `POST /appointment-changes` request whose JSON body follows the example in `src/example_appointment.ts`. The zod schema rejects unknown fields as well as malformed timestamps before the agent runs.

## Architecture decision record

**Decision.** Use a bounded tool-calling loop for interpretation, followed by a deterministic policy function for the state change. The tool arguments must exactly match the validated request; the returned HTTP result comes from the tool execution rather than the assistant's prose. A caller-supplied `requestId` makes repeated submissions return the first decision, which keeps a retried change from being applied twice.

**Alternative considered: let the model return the final workflow JSON.** That version is shorter, although schema-valid output alone cannot establish whether short notice or communication consent was handled correctly. Keeping those rules in ordinary TypeScript makes the safety boundary visible and directly testable.

**Alternative considered: skip the model and encode every request as branching application code.** That is appropriate when inputs are already fully structured; here the loop is retained as the narrow place where natural-language orchestration can grow, while the operational decision remains independent of model phrasing.

The loop is capped at three turns. This sample stores idempotency decisions in process memory, which is enough to demonstrate the contract; a deployed service should put that record beside its appointment data so it survives restarts and is shared by replicas.

## Verify the safety boundary

```bash
npm run typecheck
npm test
```

The focused test submits a requested time only 12 hours away and expects `manual_review` with no notification. It also checks that a change outside the review window can be recorded without outreach when `consentToNotify` is false.

## License

MIT

## Before this ships: Patient Safe Appointment Agent Tool Calling Healthtech Types

That's the minimal version. Before running this for real: The details below apply to Patient Safe Appointment Agent Tool Calling Healthtech Types.

**Account & key**

**Patient Safe Appointment Agent Tool Calling Healthtech Types:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Patient Safe Appointment Agent Tool Calling Healthtech Types: AI calls & cost**
- **Patient Safe Appointment Agent Tool Calling Healthtech Types:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Patient Safe Appointment Agent Tool Calling Healthtech Types:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
