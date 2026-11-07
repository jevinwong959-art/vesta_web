import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { pool } from "./db";
export type User = {
  id: string;
  username: string;
  name: string;
  role: string;
  customer?: string;
  csrf?: string;
};
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return (
    expected.length === computed.length && timingSafeEqual(expected, computed)
  );
}
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export function allow(u: User, roles: string[]) {
  if (!roles.includes(u.role))
    throw new ForbiddenException("当前账号无此操作权限 / Access denied");
}
export async function authenticate(token: string | undefined): Promise<User> {
  if (!token) throw new UnauthorizedException("请先登录 / Please sign in");
  const result = await pool.query(
    "SELECT u.id,u.username,u.name,u.role,u.customer,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires>now() AND u.active=true",
    [digest(token)],
  );
  if (!result.rows[0])
    throw new UnauthorizedException("登录已过期 / Session expired");
  return result.rows[0];
}
export async function login(username: string, password: string) {
  const user = (
    await pool.query("SELECT * FROM users WHERE username=$1 AND active=true", [
      username,
    ])
  ).rows[0];
  if (!user || !verifyPassword(password, user.password))
    throw new UnauthorizedException("账号或密码不正确 / Invalid credentials");
  const token = randomBytes(32).toString("hex"),
    csrf = randomBytes(24).toString("hex");
  await pool.query(
    "INSERT INTO sessions(token,user_id,csrf,expires) VALUES($1,$2,$3,now()+interval '8 hours')",
    [digest(token), user.id, csrf],
  );
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      customer: user.customer,
      csrf,
    },
  };
}
