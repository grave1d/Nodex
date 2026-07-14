# Notion Custom Agent IDs

Two different IDs are involved:

- `https://app.notion.com/agent/<id>` contains the Custom Agent `workflowId`.
- Nodex binds inference with the internal instructions/context page ID, stored as `agentInstructionsPageId`.

Nodex 0.2.0 discovers both IDs automatically. Run:

```bash
npx nodex setup
```

Choose **Connect Notion**, then **Select Custom Agent**. The wizard saves the correct `agentInstructionsPageId` without sending a test message or creating a thread.

## Manual fallback

Only use this when discovery fails:

1. Open your Custom Agent in Notion.
2. Open DevTools → Network.
3. Send a normal message to the agent.
4. Open the `runInferenceTranscript` request payload.
5. Find `context_page_id`.
6. Save that value as `agentInstructionsPageId` in `nodex.config.json`.

Do not copy the ID from `/agent/<id>` into `agentInstructionsPageId`; that is the workflow ID. `nodex doctor` detects this mistake and proposes the matching instructions page ID when the agent is accessible.

Never share request payloads, cookies, private workspace IDs, or HAR captures.
