export interface MailMessage {
  id: string;
  subject: string;
  html: string;
  text: string;
}

export async function latestMessageTo(
  email: string,
  options?: { subject?: RegExp; after?: Date },
): Promise<MailMessage> {
  const timeoutMs = 15_000;
  const pollIntervalMs = 500;
  const start = Date.now();
  const mailpitHost = "http://localhost:8025";

  while (Date.now() - start < timeoutMs) {
    try {
      const searchRes = await fetch(
        `${mailpitHost}/api/v1/search?query=to:"${encodeURIComponent(email)}"`,
      );
      if (searchRes.ok) {
        const data = (await searchRes.json()) as {
          messages?: Array<{
            ID?: string;
            id?: string;
            Subject?: string;
            subject?: string;
            Created?: string;
            created?: string;
          }>;
        };
        const messages = data.messages ?? [];

        for (const msg of messages) {
          const id = msg.ID ?? msg.id;
          const subject = msg.Subject ?? msg.subject ?? "";
          const createdStr = msg.Created ?? msg.created;
          const createdDate = createdStr ? new Date(createdStr) : undefined;

          if (options?.after && createdDate && createdDate < options.after) {
            continue;
          }
          if (options?.subject && !options.subject.test(subject)) {
            continue;
          }

          if (id) {
            const detailRes = await fetch(
              `${mailpitHost}/api/v1/message/${encodeURIComponent(id)}`,
            );
            if (detailRes.ok) {
              const detail = (await detailRes.json()) as {
                ID?: string;
                id?: string;
                Subject?: string;
                subject?: string;
                HTML?: string;
                html?: string;
                Text?: string;
                text?: string;
              };
              return {
                id,
                subject: detail.Subject ?? detail.subject ?? subject,
                html: detail.HTML ?? detail.html ?? "",
                text: detail.Text ?? detail.text ?? "",
              };
            }
          }
        }
      }
    } catch {
      // Ignore network errors while polling
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for message to "${email}" after 15s`);
}

export function codeFrom(text: string): string {
  const match = text.match(/\b\d{6}\b/);
  if (!match) {
    throw new Error(`No 6-digit code found in message text: "${text}"`);
  }
  return match[0];
}

export function linkFrom(html: string, pathPrefix: string): string {
  const hrefMatches = html.matchAll(/href=["']([^"']+)["']/g);
  for (const match of hrefMatches) {
    const rawUrl = match[1];
    const url = rawUrl.replace(/&amp;/g, "&");
    if (url.includes(pathPrefix)) {
      return url;
    }
  }
  throw new Error(
    `No link found containing pathPrefix "${pathPrefix}" in HTML: "${html}"`,
  );
}
