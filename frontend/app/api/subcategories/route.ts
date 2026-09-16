import { NextRequest, NextResponse } from 'next/server'
// sonotrade has no subcategory taxonomy.
export async function GET(request: NextRequest) {
  const grouped = request.nextUrl.searchParams.get('grouped') === 'true'
  return NextResponse.json(grouped ? { byIndustry: {} } : { subcategories: [] },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
}
