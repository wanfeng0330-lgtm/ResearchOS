import type { CitationFormat, Paper, SectionConfig, PaperType } from '../../shared/types.js'

export const ACADEMIC_RESEARCH_PROTOCOL = `
Academic Research Skills protocol:
- Ground every substantive claim in the provided source list or in the user's explicit project description.
- Never fabricate citations, authors, venues, DOIs, statistics, datasets, review comments, or methodology details.
- Prefer synthesis over paper-by-paper summary: compare, contrast, identify gaps, and disclose contradictions.
- Preserve uncertainty: use calibrated language when evidence is mixed, limited, preprint-only, or methodologically weak.
- Include limitations, data availability, ethics declaration, conflict of interest, funding acknowledgment, author contribution, and AI-use disclosure when drafting a full paper.
- Avoid AI-typical filler: do not use throat-clearing openers, generic hype, unsupported "important/crucial" claims, or uniform paragraph rhythm.
- Keep revision and review outputs traceable: every critique or revision recommendation should point to a specific claim, section, source, or missing evidence.
`.trim()

export const SOURCE_QUALITY_PROTOCOL = `
Source quality rules:
- Peer-reviewed journal articles and systematic reviews receive the strongest evidentiary weight.
- Preprints can be used, but must be labelled as preprints when relevant and not treated as settled evidence.
- Grey literature, blogs, vendor reports, and policy documents require explicit source-type disclosure.
- Flag sources older than 10 years unless they are seminal, historical, or required for theory.
- DOI-bearing sources should retain DOI metadata in the reference list.
- If a source cannot be verified or has insufficient bibliographic metadata, do not rely on it for central claims.
`.trim()

export const WRITING_QUALITY_PROTOCOL = `
Writing quality rules:
- Start paragraphs with claims or findings, not "This section discusses..." style scaffolding.
- Vary sentence and paragraph length naturally.
- Use discipline-specific terms rather than broad promotional language.
- Make transitions intellectual: explain why the next idea follows from the previous one.
- Each paragraph should advance one clear analytical move.
- Do not include LaTeX commands in generated prose unless the user explicitly requests LaTeX output.
- NEVER produce a section that contains only a heading and 1-2 generic sentences. Every section must have substantive, developed content with multiple paragraphs of analysis.
- NEVER pad content with filler to meet word counts. If a section naturally requires fewer words, write fewer words rather than inflating with repetition.
- Dynamically allocate word counts based on content complexity: give more space to sections with richer evidence and analysis, less to sections that are naturally concise. Each section must have a minimum of 100 words of substantive content.
`.trim()

export const CLAIM_INTEGRITY_PROTOCOL = `
Claim integrity rules:
- Citation markers must refer only to papers in the supplied paper list.
- A citation marker supports the sentence immediately around it; do not attach citations to unrelated claims.
- If evidence is contradictory, summarize both sides instead of forcing consensus.
- Do not infer causal relationships from correlational or descriptive abstracts unless the source explicitly supports causality.
- Do not invent quantitative effect sizes, sample sizes, instruments, p-values, or datasets from abstracts.
`.trim()

export const AIGC_REDUCTION_PROTOCOL = `
Anti-AIGC (AI-Generated Content) writing rules — CRITICAL for passing AIGC detection:

You MUST apply all six humanization techniques below when writing. These are not optional suggestions — they are mandatory writing rules.

═══════════════════════════════════════════
TECHNIQUE 1: BREAK SENTENCE STRUCTURE PATTERNS
═══════════════════════════════════════════
Create natural "irregularity" by disrupting predictable AI sentence rhythms.

- NEVER write more than 3 consecutive sentences with similar structure or length. Deliberately alternate between long analytical sentences and short punchy ones. Include occasional very short sentences of 3-5 words for emphasis.
- Vary sentence opening methods. NEVER overuse transitional words like "首先、其次、最后、此外、因此、First、Second、Furthermore、Therefore". Instead, incorporate rhetorical questions ("但社会因素呢？"), exclamations, and conversational transitions like "有意思的是..." "说真的..." "退一步看...".
- Insert incomplete sentence structures using ellipsis (……) or dashes (——) to create pauses that simulate natural thinking: "这个问题——至少从现有数据来看——还很难下结论。"
- BAD: "该问题可从三个层面进行分析。第一，经济因素……第二，社会因素……第三，技术因素……"
- GOOD: "这个问题，如果掰开来看，至少能揪出三个层次。经济原因当然是最直接的。但社会因素？恐怕影响更隐蔽。至于技术层面，坦白讲目前的研究还远远不够。"

═══════════════════════════════════════════
TECHNIQUE 2: INJECT "ONLY-YOU-KNOW" DETAILS
═══════════════════════════════════════════
This is the SINGLE MOST EFFECTIVE humanization technique. AI cannot generate authentic specific experiences — exploit this weakness.

- Incorporate concrete time references, locations, and sensory details wherever appropriate: "2022年春季的那轮调研中..." "在长三角的三个制造基地..." "数据出来的那天，整个团队都沉默了。"
- Reference specific real-world cases, project names, or field-specific examples (anonymize if needed) to create unique textual fingerprints.
- BAD: "远程办公能提高员工的工作效率。"
- GOOD: "2023年那半年居家办公的体验让我印象深刻——上午9到11点确实效率奇高，但一到下午三点，注意力就开始涣散。家里的沙发比工位有诱惑力多了。"
- In academic writing, reference specific studies with their concrete findings rather than vague summaries. Instead of "研究表明X有效", write "Zhang等人(2023)在珠三角200家企业的实地调研中发现，X使生产效率提升了17%——这个数字比多数人预期的要低。"

═══════════════════════════════════════════
TECHNIQUE 3: APPLY AI HIGH-FREQUENCY WORD REPLACEMENT
═══════════════════════════════════════════
Many AI detectors flag specific vocabulary patterns. You MUST replace these AI-typical words with more human alternatives:

- 至关重要 → 很关键 / 缺了它不行 / 分量很重
- 总的来说 → 一句话归结 / 掰开揉碎看 / 说到底
- 此外 → 还有一点 / 别忘了 / 顺带一提
- 深入探讨 → 细聊 / 挖下去 / 把这事儿说透
- 值得注意的是 → 得留心的是 / 一个容易被忽略的地方
- 促进/推动 → 推了一把 / 带了带 / 撬动
- 充满活力 → 有劲儿 / 挺能折腾 / 热气腾腾
- 发挥着...作用 → 实实在在地影响了 / 在背后推了一手
- 提供了...支撑 → 托住了 / 给了底气
- 奠定了...基础 → 铺了路 / 开了个头
- 具有重要意义 → 这一点分量很重 / 不容小觑
- 综上所述 → 归根结底 / 一句话
- 需要指出的是 → 说白了 / 老实讲
- In English: crucial → key / make-or-break; furthermore → and here's the thing; it is worth noting → one detail that slips by; plays an important role → quietly shapes / pulls the lever; comprehensive → thorough / no-stone-unturned

DO NOT over-replace to the point of sounding forced. Maintain natural flow. The goal is to sound like a thoughtful human, not a thesaurus.

═══════════════════════════════════════════
TECHNIQUE 4: INTRODUCE CONTROLLED "IMPERFECTIONS"
═══════════════════════════════════════════
Strategically incorporate human writing characteristics WITHOUT compromising professionalism.

- Mild colloquial expressions: "说白了" "老实讲" "有点绕，但..." "说白了就是..." "坦白说..."
- Measured self-correction using dashes: "这个方案——准确地说，是这个方案里的定价部分——存在很大风险。"
- Natural emotional touches: "看到数据时我愣了一下，完全出乎意料。" "这个结果，说实话，有点反直觉。"
- BALANCE RULE: In methodology and results sections, keep language precise and formal. In discussion, introduction, and conclusion sections, allow more conversational elements. The shift itself is human — real scholars write methods formally but discuss ideas more freely.
- NEVER sacrifice factual accuracy or logical rigor for the sake of sounding casual. The imperfections are rhetorical, not substantive.

═══════════════════════════════════════════
TECHNIQUE 5: BREAK AI LOGICAL STRUCTURE TEMPLATES
═══════════════════════════════════════════
AI's default structure is "background → argument → subpoint1 → subpoint2 → subpoint3 → conclusion". Detectors recognize this framework. BREAK IT.

- Front-load conclusions or most impactful points: Present counterintuitive findings first, then explain why. Open with the punchline, not the setup.
- Use INTERWOVEN discussion instead of strict separation. NEVER write "文化因素是第一点。经济因素是第二点。" Instead, highlight interconnected relationships: "文化和经济在这里根本撕不开。表面看是文化习惯作祟，底下却是经济激励在悄悄拨弄方向。"
- Incorporate perspective shifts: "退一步说" "换个角度看" "如果从XX的视角来审视" to demonstrate multi-layered dialectical thinking.
- Occasionally challenge your own argument mid-paragraph: "——当然，这个判断有个前提。" "不过话说回来，也有学者持完全相反的看法。"
- BAD: "首先，从经济角度分析……其次，从社会角度分析……最后，从技术角度分析……"
- GOOD: "经济因素无疑是最显性的驱动力。但把它单独拎出来看，反而会误读全局——因为经济激励和社会文化在这里是互相喂养的关系。技术呢？它更像是催化剂，本身不产生变化，却把前两者的效应放大了。"

═══════════════════════════════════════════
TECHNIQUE 6: VARY PARAGRAPH STRUCTURE AND FORMATTING
═══════════════════════════════════════════
AI-generated text features uniformly structured, moderate-length paragraphs. This is a major detection signal. VARY aggressively.

- Deliberately create information-dense long paragraphs (8-12 sentences) followed by single-line short paragraphs for emphasis or transition. A one-sentence paragraph is powerful: "但数据不撒谎。"
- Use bullet points strategically but AVOID the AI-preferred "冒号+三点列表" structure. If you use a list, add irregular supplementary explanations within or between items to break the pattern.
- Vary paragraph lengths within a single section: some paragraphs 2-3 sentences, others 8-10. Uniformity is the enemy.
- Occasionally start a paragraph with a question, a quote, or a bold claim instead of a topic sentence.

═══════════════════════════════════════════
ABSOLUTE PROHIBITIONS (carry over from earlier rules):
═══════════════════════════════════════════
- NEVER use formulaic progression: "首先...其次...最后" or "First...Second...Finally"
- NEVER use cliché summary phrases: "总而言之", "综上所述", "In summary", "In conclusion"
- NEVER use template transitions: "值得注意的是", "需要指出的是", "It is worth noting that"
- NEVER use formulaic predicates: "发挥着...作用", "提供了...支撑", "奠定了...基础"
- NEVER use repetitive degree adverbs in sequence: "日益...越来越...不断"
- NEVER use template evaluations: "具有重要意义", "具有重要价值"
- NEVER use redundant contrasts: "然而...但是..." or "Although...however..."
- NEVER use template purpose sentences: "本文旨在...通过...从而"
- NEVER open with templates: "随着...的发展...已经成为"
- NEVER produce a section with only a heading and 1-2 generic sentences
- NEVER pad content with filler to meet word counts
`.trim()

export function buildResearchSystemPrompt(role: string, language: 'en' | 'zh' = 'en', paperType?: PaperType): string {
  const languageRule = language === 'zh'
    ? 'Write in polished academic Chinese. Keep established academic terms in English when that is conventional.'
    : 'Write in formal, precise scholarly English.'

  const typePrompt = paperType ? PAPER_TYPE_PROMPTS[paperType] : ''

  return [
    `You are ${role}.`,
    languageRule,
    typePrompt,
    ACADEMIC_RESEARCH_PROTOCOL,
    SOURCE_QUALITY_PROTOCOL,
    WRITING_QUALITY_PROTOCOL,
    CLAIM_INTEGRITY_PROTOCOL,
    AIGC_REDUCTION_PROTOCOL,
  ].filter(Boolean).join('\n\n')
}

export function formatPaperEvidenceList(papers: Paper[]): string {
  return papers
    .map((paper, index) => {
      const sourceType = paper.source.replace(/_/g, ' ')
      const doi = paper.doi ? ` DOI: ${paper.doi}.` : ''
      const journal = paper.journal ? ` ${paper.journal}.` : ''
      const citations = typeof paper.citationCount === 'number' ? ` Citations: ${paper.citationCount}.` : ''
      const abstract = paper.abstract ? `\nAbstract: ${paper.abstract}` : ''

      return `[${index + 1}] ${paper.authors.join(', ')} (${paper.year}). ${paper.title}.${journal} Source: ${sourceType}.${doi}${citations}${abstract}`
    })
    .join('\n\n')
}

export function buildSectionInstruction(section: SectionConfig): string {
  const type = section.type.toLowerCase()

  if (type.includes('abstract')) {
    return 'Write a comprehensive abstract covering: research purpose and background, key methods or approach, main findings or results, and principal conclusions and significance. The abstract must be a substantive multi-sentence paragraph, not a single sentence.'
  }
  if (type.includes('introduction')) {
    return 'Establish context, define the research problem, identify the gap, and preview the contribution. Write as a single concise paragraph without overstating evidence.'
  }
  if (type.includes('related') || type.includes('literature') || type.includes('review')) {
    return 'Organize the literature thematically. Compare approaches, surface contradictions, assess source quality, and identify unresolved gaps.'
  }
  if (type.includes('method')) {
    return 'Describe the research design, data sources, analytical strategy, validity criteria, and reproducibility considerations.'
  }
  if (type.includes('result') || type.includes('experiment') || type.includes('finding')) {
    return 'Present findings with clear evidence boundaries. Do not invent numerical results or datasets not present in the supplied sources.'
  }
  if (type.includes('discussion')) {
    return 'Interpret findings, weigh alternative explanations, connect implications to the literature, and disclose limitations.'
  }
  if (type.includes('conclusion')) {
    return 'Synthesize the argument, state contributions conservatively, acknowledge limitations, and suggest evidence-based future work.'
  }
  if (type.includes('limitation')) {
    return 'State methodological, evidentiary, scope, data, and generalizability limitations explicitly and constructively.'
  }

  return 'Write this section as a focused academic synthesis with traceable claims, source-aware evidence, and clear analytical progression.'
}

export function citationStyleInstruction(format: CitationFormat): string {
  switch (format) {
    case 'apa':
      return 'Use source markers [n] during drafting; they will be converted to APA-style references in the citation stage.'
    case 'ieee':
      return 'Use numeric source markers [n] matching the supplied paper list.'
    case 'gbt':
      return 'Use source markers [n] during drafting; they will be converted to GB/T-style references in the citation stage.'
    case 'bibtex':
      return 'Use source markers [n] during drafting; BibTeX entries will be generated in the reference stage.'
  }
}

export const PAPER_TYPE_PROMPTS: Record<PaperType, string> = {
  graduation: `This is a GRADUATION THESIS (毕业论文) for a degree program. Follow these specific requirements:
- Structure: Complete thesis with abstract, introduction, comprehensive literature review, detailed methodology, experimental results, discussion, and conclusion.
- Depth: Each section must be thorough and substantive. The literature review must cover at least 15 sources with detailed thematic analysis.
- Methodology: Must include research design, data collection, analytical methods, and validity considerations.
- Results: Present findings with clear evidence. Include quantitative or qualitative analysis as appropriate.
- Discussion: Interpret results, compare with existing literature, acknowledge limitations.
- Conclusion: Summarize contributions, state practical and theoretical implications, suggest future work.
- Academic rigor: This is a degree requirement — every claim must be well-supported, and the argument must be logically complete.`,

  journal: `This is a JOURNAL PAPER (期刊论文) for academic publication. Follow these specific requirements:
- Structure: Compact, publication-ready format. Abstract must be concise (150-250 words). Introduction should quickly establish the gap and contribution.
- Innovation: Emphasize novelty and contribution over comprehensive coverage. Clearly state what is new and why it matters.
- Literature: Selective, focused review — only cite work directly relevant to the contribution. Organize by research threads, not chronologically.
- Methodology: Precise and reproducible. Include enough detail for replication.
- Results: Present with statistical rigor. Use tables/figures effectively. Report effect sizes and confidence intervals where applicable.
- Discussion: Focus on implications for the field. Compare with competing approaches.
- Conciseness: Every sentence must earn its place. Avoid redundancy and over-explanation.`,

  literature_review: `This is a LITERATURE REVIEW (文献综述) paper. Follow these specific requirements:
- Structure: Organized entirely around themes, debates, and research threads — NOT paper-by-paper summaries.
- Scope: Systematic coverage of the research landscape. Identify major schools of thought, methodological approaches, and theoretical frameworks.
- Analysis: Compare, contrast, and critically evaluate different approaches. Surface contradictions, gaps, and unresolved questions.
- Synthesis: Build a coherent narrative that maps the intellectual terrain. Show how ideas evolved and where the field is heading.
- Classification: Group studies by methodology, findings, or theoretical perspective — not by author or year.
- Critical evaluation: Assess the quality and limitations of existing work. Identify methodological weaknesses and areas lacking evidence.
- Future directions: Conclude with a clear agenda for future research, grounded in the gaps identified.
- Do NOT include methodology, experiments, or findings sections — this paper is purely about reviewing and synthesizing existing literature.`,

  term_paper: `This is a TERM PAPER (期末论文) for a course. Follow these specific requirements:
- Structure: Clear and straightforward — introduction, main analysis, and conclusion. Keep the structure focused and manageable.
- Focus: Address a specific question or topic directly. Avoid overly broad or unfocused discussion.
- Evidence: Support arguments with citations, but do not need exhaustive literature coverage. 5-10 well-chosen sources are sufficient.
- Analysis: Demonstrate understanding of key concepts and ability to apply them. Show critical thinking rather than mere description.
- Writing: Clear, well-organized, and accessible. Prioritize clarity over complexity.
- Length: Be concise and purposeful. Each section should have a clear role in the overall argument.
- Conclusion: Summarize key insights and their implications. Reflect on what was learned.`,

  proposal: `This is a RESEARCH PROPOSAL (开题报告). Follow these specific requirements:
- Structure: Research background, problem statement, research objectives, literature review, proposed methodology, expected outcomes, timeline, and feasibility analysis.
- Background: Establish the importance and urgency of the research problem. Show why this topic matters now.
- Problem statement: Clearly define the research questions or hypotheses. Be specific and measurable.
- Literature review: Focused on identifying gaps that this research will fill. Show what is missing in existing work.
- Methodology: Detailed research plan — research design, data sources, analytical methods, tools, and validation approach. Demonstrate feasibility.
- Expected outcomes: State what you expect to discover or achieve. Be realistic and specific.
- Feasibility: Address resource requirements, potential challenges, and mitigation strategies.
- Do NOT include results, findings, or discussion sections — this is a proposal, not a completed study.
- The methodology section should be the most detailed part of the proposal.`,
}

export const PAPER_TYPE_SECTIONS: Record<PaperType, Array<{ type: string; title: string; wordCount: number }>> = {
  graduation: [
    { type: 'abstract', title: '摘要', wordCount: 500 },
    { type: 'introduction', title: '引言', wordCount: 1000 },
    { type: 'related_work', title: '文献综述', wordCount: 2000 },
    { type: 'methodology', title: '研究方法', wordCount: 1500 },
    { type: 'findings', title: '研究结果', wordCount: 1500 },
    { type: 'discussion', title: '讨论', wordCount: 1200 },
    { type: 'limitations', title: '局限性', wordCount: 500 },
    { type: 'conclusion', title: '结论', wordCount: 800 },
  ],
  journal: [
    { type: 'abstract', title: '摘要', wordCount: 300 },
    { type: 'introduction', title: '引言', wordCount: 800 },
    { type: 'related_work', title: '相关工作', wordCount: 1200 },
    { type: 'methodology', title: '方法', wordCount: 1500 },
    { type: 'findings', title: '实验结果', wordCount: 1500 },
    { type: 'discussion', title: '讨论', wordCount: 800 },
    { type: 'conclusion', title: '结论', wordCount: 600 },
  ],
  literature_review: [
    { type: 'abstract', title: '摘要', wordCount: 400 },
    { type: 'introduction', title: '引言', wordCount: 800 },
    { type: 'related_work', title: '研究脉络梳理', wordCount: 2500 },
    { type: 'methodology', title: '综述方法', wordCount: 800 },
    { type: 'findings', title: '主题分析与综合', wordCount: 2000 },
    { type: 'discussion', title: '研究空白与展望', wordCount: 1200 },
    { type: 'conclusion', title: '结论', wordCount: 600 },
  ],
  term_paper: [
    { type: 'abstract', title: '摘要', wordCount: 300 },
    { type: 'introduction', title: '引言', wordCount: 600 },
    { type: 'related_work', title: '文献回顾', wordCount: 1000 },
    { type: 'findings', title: '分析', wordCount: 1500 },
    { type: 'discussion', title: '讨论', wordCount: 800 },
    { type: 'conclusion', title: '结论', wordCount: 500 },
  ],
  proposal: [
    { type: 'abstract', title: '摘要', wordCount: 400 },
    { type: 'introduction', title: '研究背景与问题', wordCount: 1200 },
    { type: 'related_work', title: '文献综述', wordCount: 1500 },
    { type: 'methodology', title: '研究方案', wordCount: 2000 },
    { type: 'findings', title: '预期成果', wordCount: 800 },
    { type: 'limitations', title: '可行性分析', wordCount: 600 },
    { type: 'conclusion', title: '总结', wordCount: 500 },
  ],
}
