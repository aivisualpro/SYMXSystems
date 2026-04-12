import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { SymxEveryday } from "@/lib/models/SymxEveryday";


export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const url = new URL(req.url);


        const date = url.searchParams.get("date");

        if (!date) {
            return NextResponse.json({ error: "Date is required" }, { status: 400 });
        }

        const record = await SymxEveryday.findOne({ date });
        return NextResponse.json({ notes: record?.notes || "" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const { date, notes } = await req.json();

        if (!date) {
            return NextResponse.json({ error: "Date is required" }, { status: 400 });
        }

        const record = await SymxEveryday.findOneAndUpdate(
            { date },
            { notes },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, record });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
