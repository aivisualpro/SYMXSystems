import { jwtVerify } from "jose";

export const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
export const key = new TextEncoder().encode(secretKey);

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}
