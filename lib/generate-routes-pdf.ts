import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RouteForPDF {
    employeeName: string;
    van: string;
    pad: string;
    waveTime: string;
    stagingLocation: string;
}

/**
 * Generate and download a SYMX Logistics route roster PDF for a given date.
 */
export async function generateRoutesPDF(
    yearWeek: string,
    date: string
): Promise<void> {
    // Fetch route data from the API
    const res = await fetch(
        `/api/dispatching/routes?yearWeek=${encodeURIComponent(yearWeek)}`
    );
    if (!res.ok) throw new Error("Failed to fetch route data");
    const data = await res.json();

    // Filter by date and only "route" type (working drivers)
    const routes: RouteForPDF[] = (data.routes || [])
        .filter((r: any) => {
            const rDate = (r.date || "").split("T")[0];
            if (rDate !== date) return false;
            const type = (r.type || "").trim().toLowerCase();
            return type === "route";
        })
        .map((r: any) => {
            const emp = data.employees?.[r.transporterId];
            return {
                employeeName: emp?.name || r.transporterId || "",
                van: (r.van && data.vehicleNames?.[r.van]) || r.van || "",
                pad: r.pad || "",
                waveTime: r.waveTime || "",
                stagingLocation: r.stagingLocation || "",
            };
        })
        .sort((a: RouteForPDF, b: RouteForPDF) =>
            a.employeeName.localeCompare(b.employeeName)
        );

    if (routes.length === 0) {
        throw new Error("No route data found for this date");
    }

    // Format the date as M/D/YYYY
    const d = new Date(date + "T00:00:00Z");
    const dateLabel = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;

    // Create PDF (Letter size, portrait)
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();

    // ── Fetch logo image ──
    let logoDataUrl: string | null = null;
    try {
        const logoRes = await fetch("/sidebar-icon.png");
        const logoBlob = await logoRes.blob();
        logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
        });
    } catch {
        // Logo load failed — will skip the image
    }

    // ── Header: SYMX Logistics ──
    const headerY = 30;
    const logoSize = 22;

    // Add logo image (or fallback circle)
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", pageW / 2 - 90, headerY - 4, logoSize, logoSize);
    } else {
        doc.setFillColor(41, 121, 255);
        doc.circle(pageW / 2 - 80, headerY + 6, 8, "F");
    }

    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SYMX", pageW / 2 - 64, headerY + 12);
    doc.setFont("helvetica", "normal");
    doc.text("Logistics", pageW / 2 - 24, headerY + 12);

    // ── Subheader: Date | Clock-in notice ──
    const subY = headerY + 32;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(36, subY - 5, pageW - 36, subY - 5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(dateLabel, 40, subY + 8);

    doc.setFont("helvetica", "bold");
    doc.text("Clock in NO earlier than 10:30 AM", pageW / 2, subY + 8, { align: "center" });

    // ── Table ──
    const tableData = routes.map((r, idx) => [
        r.employeeName,
        r.van,
        r.pad,
        r.waveTime,
        r.stagingLocation,
        String(idx + 1),
    ]);

    autoTable(doc, {
        startY: subY + 18,
        head: [["NAME", "VAN", "PAD", "WAVE TIME", "STG LOCATION", "#"]],
        body: tableData,
        margin: { left: 36, right: 36 },
        styles: {
            fontSize: 9,
            cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
            textColor: [0, 0, 0],
            font: "helvetica",
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 9,
            halign: "left",
        },
        bodyStyles: {
            fillColor: [255, 255, 255],
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245],
        },
        columnStyles: {
            0: { cellWidth: "auto", halign: "left" },   // NAME
            1: { cellWidth: 60, halign: "center" },       // VAN
            2: { cellWidth: 60, halign: "center" },       // PAD
            3: { cellWidth: 90, halign: "center" },       // WAVE TIME
            4: { cellWidth: 100, halign: "center" },      // STG LOCATION
            5: { cellWidth: 30, halign: "center" },        // #
        },
        theme: "grid",
    });

    // Save
    const safeDateStr = date.replace(/-/g, "");
    doc.save(`SYMX_Routes_${safeDateStr}.pdf`);
}
