const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto("file:///C:/Users/ADMINI~1/AppData/Local/Temp/opencode/og.html");
  await p.waitForTimeout(300);
  await p.screenshot({ path: "public/og.png", type: "png" });
  await b.close();
  console.log("og.png generado");
})();
