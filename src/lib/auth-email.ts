import { getAuthMailConfig } from "@/lib/auth-config";
import { consumeRateLimit } from "@/lib/rateLimit";

type MessageKind = "verification" | "reset";

const templates = {
  verification: {
    subject: "验证你的 PPTGod 邮箱",
    instructions: "打开下面的链接，验证你的 PPTGod 邮箱。链接在 1 小时后失效。",
  },
  reset: {
    subject: "重置你的 PPTGod 密码",
    instructions: "打开下面的链接，重置你的 PPTGod 密码。链接在 30 分钟后失效。",
  },
};

export async function sendAccountEmail(kind: MessageKind, to: string, url: string) {
  const config = getAuthMailConfig();
  if (!config) throw new Error("Email delivery is not configured");

  const recipient = await consumeRateLimit(`mail:recipient:${to.toLowerCase()}`, 4, 60 * 60 * 1000);
  const daily = recipient.allowed && await consumeRateLimit("mail:global", 80, 24 * 60 * 60 * 1000);
  if (!daily || !daily.allowed) throw new Error("Email delivery limit reached");

  const { subject, instructions } = templates[kind];
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject,
      text: `${instructions}\n\n${url}\n\n如果你没有发起此操作，可以忽略这封邮件。`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`Resend returned status ${result.status}`);
}
