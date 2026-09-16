import { NextResponse } from 'next/server'
// sonotrade has no industry taxonomy.
export async function GET() { return NextResponse.json({ counts: {}, total: 0 }) }
