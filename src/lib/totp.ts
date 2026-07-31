import { generateSecret, generateURI, verify } from "otplib";

export function generateTotpSecret() {
  return generateSecret();
}

export function totpUri(email: string, secret: string) {
  return generateURI({
    issuer: "Spendfolio",
    label: email,
    secret,
  });
}

export async function verifyTotp(token: string, secret: string) {
  const result = await verify({ token, secret });
  return result.valid;
}
