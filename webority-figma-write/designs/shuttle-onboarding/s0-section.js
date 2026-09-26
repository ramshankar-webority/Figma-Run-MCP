let maxY = 0;
for (const n of figma.currentPage.children) if ("y" in n && n.y + n.height > maxY) maxY = n.y + n.height;
const section = flowSection("OfficeLoop V2 · Splash, onboarding & profile", "OfficeLoop Onboarding", "First launch to first booking: splash, three intro screens, sign in, OTP, commute setup, permissions, and the rider profile.", ["Splash", "Intro 1 · Book", "Intro 2 · Track", "Intro 3 · Save", "Sign in", "Verify OTP", "Set up commute", "Permissions", "Profile"], Math.round(maxY + 200));
return { sectionId: section.id };
