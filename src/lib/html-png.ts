/** Standalone HTML (app/logo build) ko PNG image bana kar seedha download karta hai. */
export async function downloadHtmlAsPng(html: string, fileName: string, width = 1280): Promise<void> {
  const { default: html2canvas } = await import("html2canvas-pro");

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:1200px;border:0;opacity:0;pointer-events:none;`;
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
    await Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.onload = () => r();
              img.onerror = () => r();
            }),
      ),
    );
    if (doc.fonts?.ready) await doc.fonts.ready.catch(() => undefined);

    const target = doc.body;
    const height = Math.min(Math.max(target.scrollHeight, 400), 12000);
    const bg = frame.contentWindow?.getComputedStyle(target).backgroundColor;

    const canvas = await html2canvas(target, {
      backgroundColor: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : null,
      scale: 2,
      useCORS: true,
      windowWidth: width,
      windowHeight: height,
      width,
      height,
    });

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("PNG failed");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } finally {
    frame.remove();
  }
}
