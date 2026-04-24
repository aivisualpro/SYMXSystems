import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SYMXRoutesInfo from '@/lib/models/SYMXRoutesInfo';

export async function GET() {
  await connectToDatabase();
  const docs = await SYMXRoutesInfo.find({ date: new Date("2026-04-23") }).limit(2).lean();
  return NextResponse.json(docs);
}
