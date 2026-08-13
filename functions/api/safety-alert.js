const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

export async function onRequestGet(context) {
  return json({
    pinConfigured: Boolean(context.env.ALERT_PIN),
    teamsConfigured: Boolean(context.env.TEAMS_WORKFLOW_URL),
    configured: Boolean(
      context.env.ALERT_PIN &&
      context.env.TEAMS_WORKFLOW_URL
    )
  });
}

export async function onRequestPost(context) {
  const expectedPin = String(context.env.ALERT_PIN || '');
  const suppliedPin = String(
    context.request.headers.get('x-alert-pin') || ''
  );

  // PIN must exist before anything can be unlocked.
  if (!expectedPin) {
    return json({
      error: 'Safety Alert PIN is not configured.'
    }, 503);
  }

  // Check PIN first.
  if (!suppliedPin || suppliedPin !== expectedPin) {
    return json({
      error: 'Invalid Safety Alert PIN.'
    }, 401);
  }

  let body;

  try {
    body = await context.request.json();
  } catch {
    return json({
      error: 'Invalid request.'
    }, 400);
  }

  // Allow the hidden Safety Alert screen to unlock
  // even before Microsoft Teams is connected.
  if (body?.action === 'unlock') {
    return json({
      ok: true,
      unlocked: true,
      teamsConfigured: Boolean(context.env.TEAMS_WORKFLOW_URL)
    });
  }

  // Teams is only required when actually sending an alert.
  if (!context.env.TEAMS_WORKFLOW_URL) {
    return json({
      error: 'Microsoft Teams has not been connected yet.'
    }, 503);
  }

  const recipients = Array.isArray(body?.recipients)
    ? body.recipients
    : [];

  const message = String(body?.message || '').trim();

  if (!message) {
    return json({
      error: 'Alert message is required.'
    }, 400);
  }

  if (!recipients.length) {
    return json({
      error: 'Select at least one job lead.'
    }, 400);
  }

  if (recipients.length > 50) {
    return json({
      error: 'Too many recipients.'
    }, 400);
  }

  const cleanRecipients = recipients
    .map(x => ({
      name: String(x?.name || '')
        .trim()
        .slice(0, 120),

      email: String(x?.email || '')
        .trim()
        .toLowerCase()
        .slice(0, 254)
    }))
    .filter(x =>
      x.name &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)
    );

  if (!cleanRecipients.length) {
    return json({
      error: 'No valid recipients.'
    }, 400);
  }

  const teamsPayload = {
    site: String(body?.site || '').slice(0, 120),
    type: String(body?.type || '').slice(0, 80),
    severity: String(body?.severity || '').slice(0, 40),
    expiry: String(body?.expiry || '').slice(0, 120),
    message: message.slice(0, 6000),
    recipients: cleanRecipients,
    sentAt: new Date().toISOString()
  };

  let teamsResponse;

  try {
    teamsResponse = await fetch(
      context.env.TEAMS_WORKFLOW_URL,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(teamsPayload)
      }
    );
  } catch {
    return json({
      error: 'Could not reach Microsoft Teams Workflow.'
    }, 502);
  }

  if (!teamsResponse.ok) {
    return json({
      error:
        `Teams Workflow rejected the alert (${teamsResponse.status}).`
    }, 502);
  }

  return json({
    ok: true,
    recipients: cleanRecipients.length
  });
}
