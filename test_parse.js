const parseSmartTime = (val) => {
    if (!val) return "";
    const lowerVal = val.toLowerCase().trim();
    const isPM = lowerVal.includes('p');
    const isAM = lowerVal.includes('a');
    
    // Extract just numbers
    const d = val.replace(/\D/g, "");
    if (!d) return "";

    let hours = 0;
    let mins = 0;

    if (d.length <= 2) {
        hours = parseInt(d, 10);
    } else if (d.length === 3) {
        hours = parseInt(d.substring(0, 1), 10);
        mins = parseInt(d.substring(1, 3), 10);
    } else {
        hours = parseInt(d.substring(0, 2), 10);
        mins = parseInt(d.substring(2, 4), 10);
    }

    if (hours > 23) hours = 23;
    if (mins > 59) mins = 59;
    
    if (isPM && hours < 12) {
        hours += 12;
    } else if (isAM && hours === 12) {
        hours = 0;
    } else if (!isAM && !isPM && hours < 12 && hours >= 1 && hours <= 5 && d.length <= 2) {
         // Auto assume PM if they type '1' through '5'
         // Wait, the user said "say i type 16 and hit tab... it should auto change ot 4pm" -> "16" becomes 16:00 -> 4:00 PM.
         // And "even if i type 4pm, it should format". So 4pm -> 16:00 -> 4:00 PM.
    }

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

console.log(parseSmartTime("16"));
console.log(parseSmartTime("4pm"));
console.log(parseSmartTime("430p"));
console.log(parseSmartTime("16:30"));
