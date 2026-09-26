// Six image slots created by the structure build, matched to their Pexels photo.
const slots = [
  ["4401:7",  "1639562"],
  ["4401:54", "20115306"],
  ["4401:62", "2347311"],
  ["4401:72", "2874989"],
  ["4401:80", "132694"],
  ["4401:99", "7362967"]
];
const done = [];
for (const [nodeId, pexelsId] of slots) done.push(await paintSlot(nodeId, pexelsId));
return { painted: done };
