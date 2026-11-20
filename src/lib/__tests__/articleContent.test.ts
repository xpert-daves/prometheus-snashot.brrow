import {
  extractArticleFaqItems,
  extractArticleHeadings,
  preprocessArticleSource,
} from "../articleContent";

describe("articleContent helpers", () => {
  it("rewrites markdown links with class attributes into safe JSX anchors", () => {
    const output = preprocessArticleSource("[Text](sms:123){ .btn .btn-primary }");

    expect(output).toContain('<a href="sms:123" className="btn btn-primary">Text</a>');
  });

  it("drops unsafe hrefs instead of emitting anchor markup", () => {
    const output = preprocessArticleSource("[Bad](javascript:evil){ .btn }");

    expect(output).toContain("Bad");
    expect(output).not.toContain("<a ");
  });

  it("extracts stable heading ids from article markdown", () => {
    expect(
      extractArticleHeadings("## Intro\n\n### Overview\n\n## Intro")
    ).toEqual([
      { id: "intro", text: "Intro", level: 2 },
      { id: "overview", text: "Overview", level: 3 },
      { id: "intro-1", text: "Intro", level: 2 },
    ]);
  });

  it("extracts plain-text questions and answers from an FAQ section", () => {
    const source = [
      "## FAQ: Shed Questions",
      "",
      "### Do I need a permit?",
      "",
      "See our [permit guide](/news/permits) for **details**.",
      "",
      "### Can I get a quote online?",
      "",
      "Yes.",
      "",
      "## Final Takeaway",
      "",
      "Not part of the FAQ.",
    ].join("\n");

    expect(extractArticleFaqItems(source)).toEqual([
      {
        question: "Do I need a permit?",
        answer: "See our permit guide for details.",
      },
      {
        question: "Can I get a quote online?",
        answer: "Yes.",
      },
    ]);
  });
});
