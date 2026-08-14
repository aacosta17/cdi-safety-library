const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });

function cleanAlertMessage(incomingMessage, severity, site, type) {
  let text = String(incomingMessage || '').trim();

  /*
    Remove the OLD website-generated header completely.

    We look for:
    CDI SAFETY ALERT

    Then we find the first occurrence of the alert TYPE
    (example: "Lightning Stand Down" or "Severe Weather")

    Everything through the end of that type is removed.
  */

  const upperText = text.toUpperCase();
  const alertMarker = 'CDI SAFETY ALERT';

  const markerIndex = upperText.indexOf(alertMarker);

  if (markerIndex >= 0 && markerIndex < 30) {
    const typeText = String(type || '').trim();

    if (typeText) {
      const typeIndex = upperText.indexOf(
        typeText.toUpperCase(),
        markerIndex
      );

      if (typeIndex >= 0) {
        text = text.slice(typeIndex + typeText.length);
      }
    }
  }

  /*
    Remove leftover punctuation/spaces/newlines from
    where the old header was removed.
  */

  text = text
    .replace(/^[\s·|:—–\-]+/, '')
    .trim();

  /*
    Make sure "Issued" is separated from the instructions.

    Example:

    instructions.Issued Aug 13...

    becomes:

    instructions.

    Issued Aug 13...
  */

  text = text.replace(
    /\s*Issued\s+/i,
    '\n\nIssued '
  );

  /*
    Remove excessive blank lines.
  */

  text = text
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  /*
    Build ONE clean header.
  */

  const headerParts = [];

  if (severity) {
    headerParts.push(String(severity).trim());
  }

  if (site) {
    headerParts.push(String(site).trim());
  }

  if (type) {
    headerParts.push(String(type).trim());
  }

  const header =
    `ℹ️ CDI SAFETY ALERT — ${headerParts.join(' · ')}`;

  if (!text) {
    return header;
  }

  return `${header}\n\n${text}`;
}

export async function onRequestGet(context) {
  return json({
    pinConfigured: Boolean(context.env.ALERT_PIN),

    teamsConfigured: Boolean(
      context.env.TEAMS_WORKFLOW_URL
    ),

    configured: Boolean(
      context.env.ALERT_PIN &&
      context.env.TEAMS_WORKFLOW_URL
    )
  });
}

export async function onRequestPost(context) {
  /*
    -----------------------------------------
    GET SECRET PIN
    -----------------------------------------
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

  /*
    -----------------------------------------
    READ WEBSITE REQUEST
    -----------------------------------------
  */

  let body = {};

  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  /*
    PIN can come from the header or request body.
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

  /*
    -----------------------------------------
    CHECK TEAMS CONNECTION
    -----------------------------------------
  */

  const teamsWorkflowUrl =
    context.env.TEAMS_WORKFLOW_URL;

  if (!teamsWorkflowUrl) {
    return json(
      {
        error:
          'Microsoft Teams Workflow is not configured.'
      },
      503
    );
  }

  /*
    -----------------------------------------
    CLEAN WEBSITE VALUES
    -----------------------------------------
  */

  const site = String(
    body?.site || ''
  )
    .trim()
    .slice(0, 120);

  const type = String(
    body?.type || ''
  )
    .trim()
    .slice(0, 80);

  const severity = String(
    body?.severity || ''
  )
    .trim()
    .slice(0, 40);

  const expiry = String(
    body?.expiry || ''
  )
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
    -----------------------------------------
    PIN-ONLY UNLOCK CHECK
    -----------------------------------------

    The website can check the PIN without
    actually sending an alert.
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
    -----------------------------------------
    VALIDATE ALERT
    -----------------------------------------
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
    -----------------------------------------
    CLEAN RECIPIENTS
    -----------------------------------------
  */

  const cleanRecipients = recipients
    .map((person) => ({
      name: String(
        person?.name || ''
      )
        .trim()
        .slice(0, 120),

      email: String(
        person?.email || ''
      )
        .trim()
        .toLowerCase()
        .slice(0, 254)
    }))

    .filter((person) => {
      return (
        person.name &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          person.email
        )
      );
    });

  if (!cleanRecipients.length) {
    return json(
      {
        error: 'No valid recipients.'
      },
      400
    );
  }

  /*
    -----------------------------------------
    BUILD CLEAN TEAMS MESSAGE
    -----------------------------------------
  */

  const finalMessage = cleanAlertMessage(
    incomingMessage,
    severity,
    site,
    type
  );

  /*
    -----------------------------------------
    DATA FOR POWER AUTOMATE
    -----------------------------------------

    Keep these names unchanged because your
    Parse JSON / Apply to each flow uses them.
  */

  const teamsPayload = {
    site,
    type,
    severity,
    expiry,

    message: finalMessage.slice(0, 6000),

    recipients: cleanRecipients,

    sentAt: new Date().toISOString()
  };

  /*
    -----------------------------------------
    SEND TO POWER AUTOMATE / TEAMS
    -----------------------------------------
  */

  let teamsResponse;

  try {
    teamsResponse = await fetch(
      teamsWorkflowUrl,
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
    -----------------------------------------
    CHECK MICROSOFT RESPONSE
    -----------------------------------------
  */

  if (!teamsResponse.ok) {
    let responseText = '';

    try {
      responseText =
        await teamsResponse.text();
    } catch {
      // Nothing needed here.
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
    -----------------------------------------
    SUCCESS
    -----------------------------------------
  */

  const count = cleanRecipients.length;

  return json({
    ok: true,

    sent: count,

    message:
      `Alert sent to ${count} selected job lead` +
      `${count === 1 ? '' : 's'} in Teams.`
  });
}
