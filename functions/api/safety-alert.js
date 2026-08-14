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
  const expectedPin = String(context.env.ALERT_PIN || '').trim();

  if (!expectedPin) {
    return json(
      { error: 'Safety Alert PIN is not configured.' },
      503
    );
  }

  let body = {};

  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const suppliedPin = String(
    context.request.headers.get('x-alert-pin') ||
    body?.pin ||
    body?.alertPin ||
    ''
  ).trim();

  if (!suppliedPin || suppliedPin !== expectedPin) {
    return json(
      { error: 'Invalid Safety Alert PIN.' },
      401
    );
  }

  if (!context.env.TEAMS_WORKFLOW_URL) {
    return json(
      { error: 'Microsoft Teams Workflow is not configured.' },
      503
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

  // Allow PIN-only unlock checks.
  const isUnlockOnly =
    !site &&
    !type &&
    !severity &&
    !incomingMessage &&
    recipients.length === 0;

  if (isUnlockOnly) {
    return json({
      ok: true,
      authorized: true
    });
  }

  if (!incomingMessage) {
    return json(
      { error: 'Alert message is required.' },
      400
    );
  }

  if (!recipients.length) {
    return json(
      { error: 'Select at least one job lead.' },
      400
    );
  }

  if (recipients.length > 50) {
    return json(
      { error: 'Too many recipients.' },
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
      { error: 'No valid recipients.' },
      400
    );
  }

  /*
    ----------------------------------------------------
    REBUILD THE TEAMS MESSAGE HEADER
    ----------------------------------------------------

    We do not trust the website's first line spacing.

    We rebuild the first line as:

    ℹ️ CDI SAFETY ALERT — Advisory · SITE · Safety Notice
  */

  const lines = incomingMessage.split(/\r?\n/);

  // Remove the old first line because we are rebuilding it.
  if (
    lines.length &&
    /CDI SAFETY ALERT/i.test(lines[0])
  ) {
    lines.shift();
  }

  // Remove blank lines at the beginning.
  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  const headerParts = [];

  if (severity) headerParts.push(severity);
  if (site) headerParts.push(site);
  if (type) headerParts.push(type);

  const header =
    `ℹ️ CDI SAFETY ALERT — ${headerParts.join(' · ')}`;

  let message = header;

  if (lines.length) {
    message += `\n${lines.join('\n')}`;
  }

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
    } catch {}

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
