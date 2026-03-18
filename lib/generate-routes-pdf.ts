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
    const logoSize = 20;

    // Measure the title parts to center the whole header (logo + text)
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const symxWidth = doc.getTextWidth("SYMX ");
    doc.setFont("helvetica", "bolditalic");
    const logisticsWidth = doc.getTextWidth("Logistics");
    const totalTitleW = logoSize + 6 + symxWidth + logisticsWidth;
    const titleStartX = (pageW - totalTitleW) / 2;

    // Add logo image (or fallback circle)
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", titleStartX, headerY - 2, logoSize, logoSize);
    } else {
        doc.setFillColor(41, 121, 255);
        doc.circle(titleStartX + logoSize / 2, headerY + 8, 8, "F");
    }

    // Title — "SYMX" bold + "Logistics" bold italic
    const textX = titleStartX + logoSize + 6;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("SYMX ", textX, headerY + 14);
    doc.setFont("helvetica", "bolditalic");
    doc.text("Logistics", textX + symxWidth, headerY + 14);

    // ── Subheader: Date | Clock-in notice ──
    const subY = headerY + 30;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(36, subY - 3, pageW - 36, subY - 3);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(dateLabel, 40, subY + 10);

    doc.setFont("helvetica", "bold");
    doc.text("Clock in NO earlier than 10:30 AM", pageW / 2, subY + 10, { align: "center" });

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
        startY: subY + 20,
        head: [["NAME", "VAN", "PAD", "WAVE TIME", "STG LOCATION", "#"]],
        body: tableData,
        margin: { left: 36, right: 36 },
        styles: {
            fontSize: 10,
            cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
            textColor: [0, 0, 0],
            font: "helvetica",
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 10,
            halign: "left",
        },
        bodyStyles: {
            fillColor: [255, 255, 255],
        },
        alternateRowStyles: {
            fillColor: [230, 230, 230],
        },
        columnStyles: {
            0: { cellWidth: "auto", halign: "left" },   // NAME
            1: { cellWidth: 60, halign: "center" },       // VAN
            2: { cellWidth: 60, halign: "center" },       // PAD
            3: { cellWidth: 100, halign: "center" },      // WAVE TIME
            4: { cellWidth: 110, halign: "center" },      // STG LOCATION
            5: { cellWidth: 30, halign: "center", textColor: [140, 140, 140] },  // # (grey)
        },
        theme: "grid",
    });

    // Save
    const safeDateStr = date.replace(/-/g, "");
    doc.save(`SYMX_Routes_${safeDateStr}.pdf`);
}
