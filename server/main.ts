import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
  HttpException,
  BadRequestException,
  ForbiddenException,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
} from "@nestjs/common";
import { Request, Response, json } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express from "express";
import { z, ZodError } from "zod";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool, migrate, read, transaction, uid } from "./db";
import { seed } from "./seed";
import { authenticate, login, allow, digest, User } from "./auth";
import { action, listData, canCustomer, scanReminders } from "./domain";
import { scheduledFx } from "./fx";
import { templates, previewImport, commitImport } from "./imports";

@Catch()
class Errors implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const status =
      e instanceof ZodError
        ? 400
        : e instanceof HttpException
          ? e.getStatus()
          : 500;
    const message =
      e instanceof ZodError
        ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : status === 500
          ? "服务异常，请检查本地日志 / Server error"
          : e.message;
    if (status === 500) console.error(e);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ message });
  }
}
const attempts = new Map<string, { n: number; at: number }>();
@Controller("api/v1")
class Api {
  @Get("health") async health() {
    await pool.query("SELECT 1");
    return { ok: true, mode: "local-demo", database: "PostgreSQL" };
  }
  @Post("login") async signIn(
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const key = req.ip || "local";
    const a = attempts.get(key);
    if (a && Date.now() - a.at < 60000 && a.n >= 20)
      throw new HttpException("尝试过多，一分钟后重试", 429);
    attempts.set(key, {
      n: a && Date.now() - a.at < 60000 ? a.n + 1 : 1,
      at: a && Date.now() - a.at < 60000 ? a.at : Date.now(),
    });
    const v = z
      .object({
        username: z.string().min(1).max(80),
        password: z.string().min(1).max(200),
      })
      .parse(body);
    const result = await login(v.username, v.password);
    attempts.delete(key);
    res.cookie("vesta_session", result.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: 8 * 3600000,
    });
    return res.json(result.user);
  }
  @Get("me") me(@Req() req: Request) {
    return authenticate(req.cookies.vesta_session);
  }
  @Post("logout") async logout(@Req() req: Request, @Res() res: Response) {
    await this.writeUser(req);
    await pool.query("DELETE FROM sessions WHERE token=$1", [
      digest(req.cookies.vesta_session),
    ]);
    res.clearCookie("vesta_session", { path: "/" });
    return res.json({ ok: true });
  }
  async writeUser(req: Request) {
    const u = await authenticate(req.cookies.vesta_session);
    if (req.headers["x-csrf-token"] !== u.csrf)
      throw new ForbiddenException("CSRF token required");
    return u;
  }
  @Get("data/:kind") async data(
    @Param("kind") kind: string,
    @Req() req: Request,
  ) {
    return listData(await authenticate(req.cookies.vesta_session), kind);
  }
  @Post("actions/:name") async act(
    @Param("name") name: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const u = await this.writeUser(req);
    if (name === "scan") {
      allow(u, ["owner", "manager", "finance"]);
      return scanReminders();
    }
    return action(u, name, body);
  }
  @Get("users") async users(@Req() req: Request) {
    const u = await authenticate(req.cookies.vesta_session);
    allow(u, ["admin", "owner"]);
    return (
      await pool.query(
        "SELECT id,username,name,role,customer,active FROM users ORDER BY username",
      )
    ).rows;
  }
  @Get("templates/:kind") async template(
    @Param("kind") kind: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const u = await authenticate(req.cookies.vesta_session);
    allow(u, ["owner", "manager", "sales"]);
    if (!templates[kind]) throw new BadRequestException("模板不存在");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${kind}-template.csv"`,
    );
    res.send("\uFEFF" + templates[kind]);
  }
  @Post("imports/:kind/preview") async importPreview(
    @Param("kind") kind: string,
    @Body() b: any,
    @Req() req: Request,
  ) {
    return previewImport(
      await this.writeUser(req),
      kind,
      z
        .string()
        .max(1024 * 1024)
        .parse(b.content),
    );
  }
  @Post("imports/:id/commit") async importCommit(
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return commitImport(await this.writeUser(req), id);
  }
  @Post("users/:id/active") async active(
    @Param("id") id: string,
    @Body() b: any,
    @Req() req: Request,
  ) {
    const u = await this.writeUser(req);
    allow(u, ["admin"]);
    const active = z.boolean().parse(b.active);
    if (id === u.id) throw new BadRequestException("不能停用当前账号");
    return transaction(async (db) => {
      const r = await db.client.query(
        "UPDATE users SET active=$1 WHERE id=$2 RETURNING id,active",
        [active, id],
      );
      if (!r.rowCount) throw new BadRequestException("账号不存在");
      await db.client.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await db.audit(u.id, "user-active", id);
      return r.rows[0];
    });
  }
  @Post("contracts") async upload(@Req() req: Request, @Body() body: unknown) {
    const u = await this.writeUser(req);
    allow(u, ["owner", "manager", "sales"]);
    const v = z
      .object({
        order: z.string(),
        name: z.string().min(1).max(100),
        content: z.string().max(7 * 1024 * 1024),
        status: z.enum(["draft", "signed"]).default("draft"),
      })
      .parse(body);
    const buffer = Buffer.from(v.content, "base64");
    if (
      buffer.length > 5 * 1024 * 1024 ||
      buffer.length < 5 ||
      buffer.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new BadRequestException("仅接收 5MB 内 PDF 文件");
    return transaction(async (db) => {
      const o = await db.get("orders", v.order);
      if (!o || !(await canCustomer(db, u, o.customer)))
        throw new ForbiddenException();
      const id = uid("CT");
      await mkdir(resolve(process.env.UPLOAD_DIR || ".local/uploads"), {
        recursive: true,
      });
      await writeFile(
        resolve(process.env.UPLOAD_DIR || ".local/uploads", id + ".pdf"),
        buffer,
        {
          flag: "wx",
        },
      );
      const c = await db.put("contracts", {
        id,
        order: o.id,
        customer: o.customer,
        name: v.name,
        status: v.status,
        bytes: buffer.length,
        version:
          (await db.all("contracts")).filter((c) => c.order === o.id).length +
          1,
        at: new Date().toISOString(),
      });
      await db.audit(u.id, "contract-upload", id);
      return c;
    });
  }
  @Get("contracts/:id/download") async download(
    @Param("id") id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const u = await authenticate(req.cookies.vesta_session);
    allow(u, ["owner", "manager", "sales", "finance", "customer"]);
    const c = await read((db) => db.get("contracts", id));
    if (
      !c ||
      !/^CT-[a-z0-9-]+$/.test(id) ||
      !(await read((db) => canCustomer(db, u, c.customer)))
    )
      throw new ForbiddenException();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${id}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(
      await readFile(
        resolve(process.env.UPLOAD_DIR || ".local/uploads", id + ".pdf"),
      ),
    );
  }
  @Get("export/:kind") async exportData(
    @Param("kind") kind: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const u = await authenticate(req.cookies.vesta_session);
    allow(u, ["owner", "manager", "sales", "finance"]);
    if (!["customers", "products", "orders", "quotes"].includes(kind))
      throw new BadRequestException();
    const rows = await listData(u, kind);
    const keys = Array.from(
      new Set(
        rows.flatMap((r) =>
          Object.keys(r).filter((k) => typeof r[k] !== "object"),
        ),
      ),
    );
    const cell = (v: any) =>
      '"' +
      String(v ?? "")
        .replace(/^[\s]*[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv =
      "\uFEFF" +
      [keys, ...rows.map((r) => keys.map((k) => r[k]))]
        .map((row) => row.map(cell).join(","))
        .join("\r\n");
    await transaction((db) => db.audit(u.id, "export", kind));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${kind}.csv"`);
    res.send(csv);
  }
}
@Module({ controllers: [Api] })
class AppModule {}
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "This local Demo is not approved for public deployment. Complete VESTA-110 first.",
    );
  await migrate();
  await seed();
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
    bodyParser: false,
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.use(json({ limit: "8mb" }));
  app.use(cookieParser());
  const origins = (
    process.env.APP_ORIGINS ||
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3100,http://localhost:3100"
  ).split(",");
  app.use((req: Request, res: Response, next: () => void) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    ) {
      res.status(403).json({ message: "Origin rejected" });
      return;
    }
    next();
  });
  app.use(express.static(resolve("dist/web")));
  app.useGlobalFilters(new Errors());
  await app.listen(Number(process.env.PORT || 3100), "127.0.0.1");
  console.log(`Vesta local: http://127.0.0.1:${process.env.PORT || 3100}`);
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await scanReminders();
      await scheduledFx();
    } catch (e) {
      console.error("background", e);
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60000);
  timer.unref();
  const close = async () => {
    clearInterval(timer);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
