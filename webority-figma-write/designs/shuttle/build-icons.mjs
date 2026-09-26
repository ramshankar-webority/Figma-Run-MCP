// Builds icons.json for the shuttle design from the local Iconsax set (iconsax-react naming).
import fs from "node:fs";
const root = new URL("../../icons/iconsax/", import.meta.url);
const linear = ["home2","bus","ticket","profile-circle","notification","location","location-tick","calendar1","calendar-tick","clock","arrow-left","arrow-right","arrow-swap-vertical","search-normal1","tick-circle","info-circle","call","message","routing2","gps","wallet","card","shield-tick","repeat","building","buildings2","edit2","more","close-circle","scan-barcode","timer1","people","direct-right","star1","add","flash","sun1","moon","receipt2","export","user","money","discount-shape","arrow-down","filter","sms","wallet-check","danger","trash","map1","location-add","home","lamp-charge","coffee","shield-security","send-2","direct-up"];
const bold = ["home2","bus","ticket","profile-circle","tick-circle","location","star1","clock","sun1","moon","gps","flash","shield-tick","wallet","card","calendar1","user","buildings2","home","routing2"];
const out = {};
for (const [v, list] of [["linear", linear], ["bold", bold]]) for (const n of list) {
  const f = new URL(`${v}/${n}.svg`, root);
  if (!fs.existsSync(f)) { console.log("missing", v, n); continue; }
  out[`${n}-${v}`] = fs.readFileSync(f, "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}
fs.writeFileSync(new URL("./icons.json", import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length, "icons");
