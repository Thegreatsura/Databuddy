import { Elysia, t } from "elysia";
import { db } from "@databuddy/db";
import { eq } from "drizzle-orm";
import { websites } from "@databuddy/db";
import { auth } from "@databuddy/auth";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import {
    processAssistantRequest,
    createStreamingResponse,
    type AssistantRequest,
    type AssistantContext
} from "../agent";

// ============================================================================
// SCHEMAS
// ============================================================================

const AssistantRequestSchema = t.Object({
    message: t.String(),
    website_id: t.String(),
    model: t.Optional(t.Union([
        t.Literal('chat'),
        t.Literal('agent'),
        t.Literal('agent-max')
    ])),
    context: t.Optional(t.Object({
        previousMessages: t.Optional(t.Array(t.Object({
            role: t.Optional(t.String()),
            content: t.String()
        })))
    }))
});

// ============================================================================
// ROUTER SETUP
// ============================================================================

export const assistant = new Elysia({ prefix: '/v1/assistant' })
    .use(createRateLimitMiddleware({ type: 'expensive' }))
    .derive(async ({ request }) => {
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session?.user) {
            throw new Error('Unauthorized');
        }

        return { user: session.user, session };
    })
    .post('/stream', async ({ body, user }) => {
        const { message, website_id, model, context } = body;

        // Get website info from the website_id in the body
        const website = await db.query.websites.findFirst({
            where: eq(websites.id, website_id),
        });

        if (!website) {
            return createStreamingResponse((async function* () {
                yield { type: 'error', content: 'Website not found' };
            })());
        }

        const assistantRequest: AssistantRequest = {
            message,
            website_id,
            website_hostname: website.domain,
            model: model || 'chat',
            context
        };

        const assistantContext: AssistantContext = {
            user,
            website,
            debugInfo: {}
        };

        // Process the assistant request and create streaming response
        const updates = processAssistantRequest(assistantRequest, assistantContext);
        return createStreamingResponse(updates);
    }, {
        body: AssistantRequestSchema
    }); 