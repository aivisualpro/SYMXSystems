/**
 * Pulls the issued work phone and the vehicle VIN out of a Cortex payload.
 * The exact key names differ between Cortex responses, so this searches the
 * whole object for the likely keys and sanity-checks the value.
 */
function walk(obj: any, visit: (k: string, v: any) => boolean | void, depth = 0): void {
    if (!obj || typeof obj !== "object" || depth > 8) return;
    if (Array.isArray(obj)) { for (const x of obj) walk(x, visit, depth + 1); return; }
    for (const k of Object.keys(obj)) {
        if (visit(k, obj[k]) === true) return;
        walk(obj[k], visit, depth + 1);
    }
}

export function findWorkPhone(obj: any): string {
    let found = "";
    walk(obj, (k, v) => {
        if (found || typeof v !== "string" && typeof v !== "number") return;
        if (!/phone|mobile|device.?number|contact.?number|cell/i.test(k)) return;
        const s = String(v).trim();
        const digits = s.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15) { found = s; return true; }
    });
    return found;
}

export function findVin(obj: any): string {
    let found = "";
    walk(obj, (k, v) => {
        if (found || typeof v !== "string") return;
        if (!/^vin$/i.test(k) && !/vehicle.?(vin|identification)/i.test(k)) return;
        const s = v.trim().toUpperCase();
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(s)) { found = s; return true; }
    });
    return found;
}
