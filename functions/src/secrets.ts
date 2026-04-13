export function getRapidApiKey(): string {
  const key = process.env.RAPIDAPI_KEY
  if (!key) throw new Error('RAPIDAPI_KEY environment variable not set')
  return key
}
