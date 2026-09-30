import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from './errors';

type RouteCtx<P> = { params: Promise<P> };

/** Envolve um handler de API com tratamento padronizado de erros (sem vazar detalhes internos). */
export function handler<P = Record<string, string>>(fn: (req: NextRequest, ctx: RouteCtx<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return NextResponse.json({ error: issue?.message ?? 'Dados inválidos', issues: err.flatten().fieldErrors }, { status: 400 });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') return NextResponse.json({ error: 'Registro duplicado (valor já cadastrado).' }, { status: 409 });
        if (err.code === 'P2025') return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
      }
      console.error('[api]', err);
      return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Content-Type deve ser application/json');
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
  return schema.parse(data);
}

export function ok(data: unknown = { ok: true }, status = 200) {
  return NextResponse.json(data, { status });
}
