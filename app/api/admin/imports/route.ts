
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, data } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    await connectToDatabase();

    if (type === "employees") {
      // Get schema paths to dynamically handle types
      const paths = SymxEmployee.schema.paths;
      
      const operations = data.map((employee: any) => {
        const { _id, ...rawData } = employee;
        if (!rawData.email) return null;

        const processedData: any = {};
        
        Object.keys(rawData).forEach((key) => {
          const value = rawData[key];
          const schemaPath = paths[key];

          if (!schemaPath) {
            // Field not in schema, keep as is if not empty
            if (value !== undefined && value !== null && value !== "") {
              processedData[key] = value;
            }
            return;
          }

          const instance = schemaPath.instance;

          if (instance === "Boolean") {
            const valStr = value?.toString().toLowerCase().trim();
            processedData[key] = valStr === "true" || valStr === "yes" || valStr === "1";
          } else if (instance === "Date") {
            if (value && value.toString().trim() !== "") {
              try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  // Normalize to YYYY-MM-DDT00:00:00.000Z to avoid timezone shifts
                  const dateStr = date.toISOString().split('T')[0];
                  processedData[key] = new Date(`${dateStr}T00:00:00.000Z`);
                }
              } catch (e) {
                // Ignore invalid dates
              }
            }
          } else if (instance === "Number") {
             if (value && value.toString().trim() !== "") {
                const num = parseFloat(value);
                if (!isNaN(num)) processedData[key] = num;
             }
          } else {
            // Treatment for String and others
            if (value !== undefined && value !== null) {
               processedData[key] = value.toString();
            }
          }
        });

        return {
          updateOne: {
            filter: { email: processedData.email },
            update: { $set: processedData },
            upsert: true,
          },
        };
      }).filter((op): op is NonNullable<typeof op> => op !== null);

      if (operations.length > 0) {
        const result = await SymxEmployee.bulkWrite(operations);
        return NextResponse.json({ 
          success: true, 
          count: result.upsertedCount + result.modifiedCount,
          matched: result.matchedCount 
        });
      }

      return NextResponse.json({ success: true, count: 0 });
    }

    return NextResponse.json({ error: "Invalid import type" }, { status: 400 });

  } catch (error: any) {
    console.error("Import API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
