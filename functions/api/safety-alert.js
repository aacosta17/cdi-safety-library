const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
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
    return json(
      {
        error: 'Safety Alert PIN is not configured.'
      },
      503
    );
  }

  // Check PIN first.
  if (!suppliedPin || suppliedPin !== expectedPin) {
    return json(
      {
        error: 'Invalid Safety Alert PIN.'
      },
      401
    );
  }

  // Teams webhook must also be configured.
  if (!context.env.TEAMS_WORKFLOW_URL) {
    return json(
      {
        error: 'Microsoft Teams Workflow is not configured.'
      },
      503
    );
  }

  let body;

  try {
    body = await context.request.json();
  } catch {
    return json(
      {
        error: 'Invalid request body.'
      },
      400
    );
  }

  const site = String(body?.site || '')
    .trim()
    .slice(0, 120);

  const type = String(body?.type || '')
    .trim()
    .slice(0, 80);

  const severity = String(body?.severity || '')
    .trim()
    .slice(0, 40);

  const expiry = String(body?.expiry || '')
    .trim()
    .slice(0, 120);

  const incomingMessage = String(body?.message || '')
    .trim()
    .slice(0, 6000);

  const recipients = Array.isArray(body?.recipients)
    ? body.recipients
    : [];

  if (!incomingMessage) {
    return json(
      {
        error: 'Alert message is required.'
      },
      400
    );
  }

  if (!recipients.length) {
    return json(
      {
        error: 'Select at least one job lead.'
      },
      400
    );
  }

  if (recipients.length > 50) {
    return json(
      {
        error: 'Too many recipients.'
      },
      400
    );
  }

  const cleanRecipients = recipients
    .map((x) => ({
      name: String(x?.name || '')
        .trim()
        .slice(0, 120),

      email: String(x?.email || '')
        .trim()
        .toLowerCase()
        .slice(0, 254)
    }))
    .filter(
      (x) =>
        x.name &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)
    );

  if (!cleanRecipients.length) {
    return json(
      {
        error: 'No valid recipients.'
      },
      400
    );
  }

  /*
    ---------------------------------------------------------
    FIX TEAMS ALERT FORMATTING
    ---------------------------------------------------------

    The website currently builds a message that can look like:

    AdvisoryALL CDI LOCATIONS

    This safely converts it to:

    Advisory · ALL CDI LOCATIONS

    without changing the rest of the message.
  */

  let message = incomingMessage;

  if (severity && site) {
    const joinedWithoutSpace = `${severity}${site}`;

    if (message.includes(joinedWithoutSpace)) {
      message = message.replace(
        joinedWithoutSpace,
        `${severity} · ${site}`
      );
    }
  }

  /*
    If the website sends the header with only a space but no separator,
    normalize that too.
  */

  if (severity && site) {
    const joinedWithSpace = `${severity} ${site}`;
    const preferred = `${severity} · ${site}`;

    if (
      message.includes(joinedWithSpace) &&
      !message.includes(preferred)
    ) {
      message = message.replace(
        joinedWithSpace,
        preferred
      );
    }
  }

  /*
    Payload that Power Automate Parse JSON receives.

    We keep all the fields Power Automate is already using:
    site
    type
    severity
    expiry
    message
    recipients
    sentAt
  */

  const teamsPayload = {
    site,
    type,
    severity,
    expiry,
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
  } catch (error) {
    console.error('Teams workflow request failed:', error);

    return json(
      {
        error: 'Could not connect to Microsoft Teams Workflow.'
      },
      502
    );
  }

  if (!teamsResponse.ok) {
    let responseText = '';

    try {
      responseText = await teamsResponse.text();
    } catch {
      // Ignore response-body read errors.
    }

    console.error(
      'Teams workflow returned an error:',
      teamsResponse.status,
      responseText
    );

    return json(
      {
        error: 'Microsoft Teams Workflow rejected the alert.',
        status: teamsResponse.status
      },
      502
    );
  }

  return json({
    ok: true,
    sent: cleanRecipients.length,
    message: `Alert sent to ${cleanRecipients.length} selected job lead${
      cleanRecipients.length === 1 ? '' : 's'
    } in Teams.`
  });
}
