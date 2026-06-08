import JSZip from "jszip";

export interface EpubChapter {
  title: string;
  text: string; // paragraphs separated by blank lines
}

export interface EpubMeta {
  title: string;
  author: string;
  slug: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraphsToHtml(text: string): string {
  const paras = text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paras.length === 0) return "<p></p>";
  return paras.map((p) => `<p>${esc(p)}</p>`).join("\n");
}

function chapterFileName(index: number, total: number): string {
  const width = Math.max(4, String(total).length);
  return `chap-${String(index + 1).padStart(width, "0")}.xhtml`;
}

function chapterDoc(title: string, text: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"/><title>${esc(title)}</title></head>
<body><h2>${esc(title)}</h2>
${paragraphsToHtml(text)}
</body></html>`;
}

/** Build a valid EPUB 3 file in memory from novel metadata and chapters. */
export async function buildEpub(meta: EpubMeta, chapters: EpubChapter[]): Promise<Buffer> {
  const zip = new JSZip();

  // The mimetype must be the first entry and stored uncompressed.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const total = chapters.length;
  const files = chapters.map((c, i) => ({
    name: chapterFileName(i, total),
    id: `c${i + 1}`,
    title: c.title || `Chapter ${i + 1}`,
    text: c.text
  }));

  const manifestItems = files
    .map((f) => `    <item id="${f.id}" href="${f.name}" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spineItems = files.map((f) => `    <itemref idref="${f.id}"/>`).join("\n");
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:novelreader:${esc(meta.slug)}</dc:identifier>
    <dc:title>${esc(meta.title)}</dc:title>
    <dc:creator>${esc(meta.author || "Unknown")}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`
  );

  const navList = files
    .map((f) => `      <li><a href="${f.name}">${esc(f.title)}</a></li>`)
    .join("\n");

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>${esc(meta.title)}</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
${navList}
    </ol>
  </nav>
</body></html>`
  );

  for (const f of files) {
    zip.file(`OEBPS/${f.name}`, chapterDoc(f.title, f.text));
  }

  return zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
}
