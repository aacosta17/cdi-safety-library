 const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const removeLeadingSeparators = (value) =>
  String(value)
    .replace(/^[\s·|:—–\-]+/, '')
    .trimStart();

function buildCleanTeamsMessage({
  incomingMessage,
  severity,
  site,
  type
}) {
  let text = String(incomingMessage || '')
    .replace(/\r\n/g, '\n')
    .trim();

  /*
    ---------------------------------------------------------
    REMOVE THE WEBSITE'S OLD HEADER
    ---------------------------------------------------------

    This handles all of these kinds of broken headers:

    WarningALL CDI LOCATIONS
    Warning ALL CDI LOCATIONS
    Warning · ALL CDI LOCATIONS
    WarningALL CDI LOCATIONS · Severe Weather
    etc.

    We only strip these fields if the message actually begins
    with "CDI SAFETY ALERT", so normal alert instructions are
    not accidentally changed.
  */

  const headerPattern =
    /^\s*ℹ️?\s*CDI\s+SAFETY\s+ALERT\s*[—–-]?\s*/i;

  const hasOldHeader = headerPattern.test(text);

  if (hasOldHeader) {
    text = text.replace(headerPattern, '');

    if (severity) {
      text = text.replace(
        new RegExp(`^${escapeRegExp(severity)}`, 'i'),
        ''
      );

      text = removeLeadingSeparators(text);
    }

    if (site) {
      text = text.replace(
        new RegExp(`^${escapeRegExp(site)}`, 'i'),
        ''
      );

      text = removeLeadingSeparators(text);
    }

    if (type) {
      text = text.replace(
        new RegExp(`^${escapeRegExp(type)}`, 'i'),
        ''
      );

      text = removeLeadingSeparators(text);
    }
  }

  /*
    ---------------------------------------------------------
    CLEAN THE REMAINING ALERT BODY
    ---------------------------------------------------------
  */

  text = text
    .replace(/^[\s·|:—–\-]+/, '')
    .trim();

  /*
    The website already creates a nice local-time Issued line.
    Separate it from the instructions so Teams always gets
    a blank line before it.

    Example:
    "...emergency instructions.Issued Aug 13..."
    becomes:
    "...emergency instructions."

    "Issued Aug 13..."
  */

  let alertBody = text;
  let issuedLine = '';

  const issuedMatch = text.match(
    /\bIssued\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+at\s+.+)$/i
  );

  if (issuedMatch) {
    const issuedIndex = issuedMatch.index;

    alertBody = text
      .slice(0, issuedIndex)
      .trim()
      .replace(/\s+$/, '');

    issuedLine = `Issued ${issuedMatch[1].trim()}`;
  }

  /*
    Remove excessive blank lines while preserving paragraph
    breaks.
  */

  alertBody = alertBody
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  /*
    ---------------------------------------------------------
    BUILD ONE NEW HEADER FROM SCRATCH
    ---------------------------------------------------------
  */

  const headerParts = [
    severity,
    site,
    type
  ].filter(Boolean);

  const cleanHeader =
    `ℹ️ CDI SAFETY ALERT — ${headerParts.join(' · ')}`;

  const sections = [cleanHeader];

  if (alertBody) {
    sections.push(alertBody);
  }

  if (issuedLine) {
    sections.push(issuedLine);
  }

  return sections.join('\n\n');
}

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
  /*
    ---------------------------------------------------------
    READ SERVER-SIDE SETTINGS
    ---------------------------------------------------------
  */

  const expectedPin = String(
    context.env.ALERT_PIN || ''
  ).trim();

  if (!expectedPin) {
    return json(
      {
        error: 'Safety Alert PIN is not configured.'
      },
      503
    );
  }

  let body = {};

  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  /*
    Accept the PIN either in the request header or body.
    This keeps the website unlock check compatible.
  */

  const suppliedPin = String(
    context.request.headers.get('x-alert-pin') ||
    body?.pin ||
    body?.alertPin ||
    ''
  ).trim();

  if (
    !suppliedPin ||
    suppliedPin !== expectedPin
  ) {
    return json(
      {
        error: 'Invalid Safety Alert PIN.'
      },
      401
    );
  }

  if (!context.env.TEAMS_WORKFLOW_URL) {
    return json(
      {
        error:
          'Microsoft Teams Workflow is not configured.'
      },
      503
    );
  }

  /*
    ---------------------------------------------------------
    CLEAN DATA RECEIVED FROM WEBSITE
    ---------------------------------------------------------
  */

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

  const incomingMessage = String(
    body?.message || ''
  )
    .trim()
    .slice(0, 6000);

  const recipients = Array.isArray(
    body?.recipients
  )
    ? body.recipients
    : [];

  /*
    The website may send a PIN-only request just to unlock
    the hidden Safety Alert panel.
  */

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

  /*
    ---------------------------------------------------------
    VALIDATE ALERT
    ---------------------------------------------------------
  */

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

  /*
    ---------------------------------------------------------
    CLEAN RECIPIENT LIST
    ---------------------------------------------------------
  */

  const cleanRecipients = recipients
    .map((person) => ({
      name: String(person?.name || '')
        .trim()
        .slice(0, 120),

      email: String(person?.email || '')
        .trim()
        .toLowerCase()
        .slice(0, 254)
    }))

    .filter(
      (person) =>
        person.name &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          person.email
        )
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
    BUILD FINAL TEAMS MESSAGE
    ---------------------------------------------------------
  */

  const cleanMessage = buildCleanTeamsMessage({
    incomingMessage,
    severity,
    site,
    type
  });

  /*
    Power Automate Parse JSON already expects these fields,
    so we are keeping the same structure.
  */

  const teamsPayload = {
    site,
    type,
    severity,
    expiry,

    message: cleanMessage.slice(0, 6000),

    recipients: cleanRecipients,

    sentAt: new Date().toISOString()
  };

  /*
    ---------------------------------------------------------
    SEND TO MICROSOFT TEAMS WORKFLOW
    ---------------------------------------------------------
  */

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
    console.error(
      'Teams workflow request failed:',
      error
    );

    return json(
      {
        error:
          'Could not connect to Microsoft Teams Workflow.'
      },
      502
    );
  }

  /*
    ---------------------------------------------------------
    CHECK TEAMS RESPONSE
    ---------------------------------------------------------
  */

  if (!teamsResponse.ok) {
    let responseText = '';

    try {
      responseText =
        await teamsResponse.text();
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
        error:
          'Microsoft Teams Workflow rejected the alert.',

        status: teamsResponse.status
      },
      502
    );
  }

  /*
    ---------------------------------------------------------
    SUCCESS
    ---------------------------------------------------------
  */

  return json({
    ok: true,

    sent: cleanRecipients.length,

    message:
      `Alert sent to ${cleanRecipients.length} ` +
      `selected job lead${
        cleanRecipients.length === 1
          ? ''
          : 's'
      } in Teams.`
  });
}
