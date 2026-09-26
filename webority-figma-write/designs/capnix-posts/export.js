const ids = ["826:3555", "826:3579", "826:3603", "826:3628", "826:3651", "826:3679", "826:3705", "826:3731", "826:3757", "826:3783", "826:3807", "826:3848", "826:3874", "826:3897", "826:3923", "826:3946", "826:3977", "826:4003", "826:4027", "826:4074", "826:4097", "826:4116"];
const out = [];
for (const id of ids) {
  const n = await figma.getNodeByIdAsync(id);
  const bytes = await n.exportAsync({ format: "JPG", constraint: { type: "SCALE", value: 0.5 } });
  out.push({ id, name: n.name, b64: figma.base64Encode(bytes) });
}
return out;
