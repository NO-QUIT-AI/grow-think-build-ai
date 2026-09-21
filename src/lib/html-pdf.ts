/** Standalone HTML ko seedha PDF file me convert kar ke download karta hai — koi print dialog nahi. */
export async function downloadHtmlAsPdf(html: string, fileName: string): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  // Offscreen iframe me page render karte hain taake preview jaisa hi dikhe.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:820px;height:1200px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("render frame not available");
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve) => {
      if (doc.readyState === "complete") resolve();
      else frame.onload = () => resolve();
      window.setTimeout(resolve, 1500);
    });

    const images = Array.from(doc.images);
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
      ),
    );
    if (doc.fonts?.ready) await doc.fonts.ready.catch(() => undefined);

    const target = (doc.querySelector(".page") as HTMLElement | null) ?? doc.body;
    const width = Math.max(target.scrollWidth, 800);
    const height = Math.ceil(target.getBoundingClientRect().height) || target.scrollHeight;

    const canvas = await html2canvas(target, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, Math.max(1.5, (window.devicePixelRatio || 1) * 1.5)),
      useCORS: true,
      windowWidth: width,
      windowHeight: height,
      width,
      height,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, imgH);
    } else {
      // Lambi CV ko A4 pages me slice karte hain.
      const sliceHeightPx = Math.floor((pageH * canvas.width) / pageW);
      let offset = 0;
      let first = true;
      while (offset < canvas.height) {
        const sliceH = Math.min(sliceHeightPx, canvas.height - offset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (!first) pdf.addPage();
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          pageW,
          (sliceH * pageW) / canvas.width,
        );
        first = false;
        offset += sliceH;
      }
    }

    const name = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } finally {
    frame.remove();
  }
}
