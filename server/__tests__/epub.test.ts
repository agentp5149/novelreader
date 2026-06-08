import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildEpub } from "../epub";

const meta = { title: "Test & Tale", author: "Some <Author>", slug: "test-tale" };
const chapters = [
  { title: "Chapter 1 - Start", text: "First para.\n\nSecond \"para\" with <tags>." },
  { title: "Chapter 2 - Next", text: "Only one paragraph." }
];

describe("buildEpub", () => {
  it("produces a valid EPUB zip with the required structure", async () => {
    const buf = await buildEpub(meta, chapters);
    const zip = await JSZip.loadAsync(buf);

    // mimetype must exist with the correct contents
    expect(await zip.file("mimetype")!.async("string")).toBe("application/epub+zip");

    // core structural files
    expect(zip.file("META-INF/container.xml")).not.toBeNull();
    expect(zip.file("OEBPS/content.opf")).not.toBeNull();
    expect(zip.file("OEBPS/nav.xhtml")).not.toBeNull();

    // one xhtml per chapter
    expect(zip.file("OEBPS/chap-0001.xhtml")).not.toBeNull();
    expect(zip.file("OEBPS/chap-0002.xhtml")).not.toBeNull();
  });

  it("escapes XML and splits paragraphs", async () => {
    const buf = await buildEpub(meta, chapters);
    const zip = await JSZip.loadAsync(buf);

    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("Test &amp; Tale");
    expect(opf).toContain("Some &lt;Author&gt;");

    const ch1 = await zip.file("OEBPS/chap-0001.xhtml")!.async("string");
    expect(ch1).toContain("<p>First para.</p>");
    expect(ch1).toContain("&quot;para&quot;");
    expect(ch1).toContain("&lt;tags&gt;");
    expect(ch1).not.toContain("<tags>");
  });

  it("lists every chapter in the spine and nav", async () => {
    const buf = await buildEpub(meta, chapters);
    const zip = await JSZip.loadAsync(buf);
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    const nav = await zip.file("OEBPS/nav.xhtml")!.async("string");
    expect((opf.match(/<itemref /g) ?? []).length).toBe(2);
    expect((nav.match(/<li>/g) ?? []).length).toBe(2);
  });
});
