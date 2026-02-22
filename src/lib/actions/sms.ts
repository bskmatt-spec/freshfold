"use server"

export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    console.warn("Twilio env vars not set — SMS not sent")
    return false
  }

  // Normalize phone: ensure E.164 format
  const normalized = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`

  try {
    const { default: twilio } = await import("twilio")
    const client = twilio(accountSid, authToken)
    await client.messages.create({ body, from, to: normalized })
    return true
  } catch (err) {
    console.error("SMS send error:", err)
    return false
  }
}
