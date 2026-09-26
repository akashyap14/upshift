// Demo data for the mock backend (spec §2 "Seed data"). Sponsor rewards are "Demo partner" only.
import type { Level, QuestionType, RewardKind, Role } from '../types'

export const COMPANY = { id: 1, name: 'Northwind Labs' }

export const SEED_USERS: { name: string; role: Role; team: string; profession: string; level: Level; points: number }[] = [
  { name: 'Asha Rao', role: 'employee', team: 'Engineering', profession: 'sde', level: 2, points: 140 },
  { name: 'Vikram Iyer', role: 'employee', team: 'Engineering', profession: 'sde', level: 1, points: 85 },
  { name: 'Neha Kulkarni', role: 'employee', team: 'Engineering', profession: 'data', level: 2, points: 210 },
  { name: 'Rohan Das', role: 'employee', team: 'Engineering', profession: 'sde', level: 3, points: 60 },
  { name: 'Priya Menon', role: 'employee', team: 'Marketing', profession: 'mkt', level: 2, points: 175 },
  { name: 'Karan Shah', role: 'employee', team: 'Marketing', profession: 'mkt', level: 1, points: 40 },
  { name: 'Divya Nair', role: 'employee', team: 'Marketing', profession: 'pm', level: 2, points: 120 },
  { name: 'Arjun Reddy', role: 'employee', team: 'Marketing', profession: 'sales', level: 2, points: 95 },
  { name: 'Meera Joshi', role: 'manager', team: 'Engineering', profession: 'sde', level: 3, points: 0 },
  { name: 'Sanjay Gupta', role: 'leader', team: 'Leadership', profession: 'founder', level: 3, points: 0 },
]

export const SEED_REWARDS: { title: string; kind: RewardKind; cost_points: number; sponsor_name: string | null; stock: number }[] = [
  { title: 'Filter coffee at a campus café', kind: 'sponsor', cost_points: 100, sponsor_name: 'Demo partner', stock: 50 },
  { title: '₹100 ride credit', kind: 'sponsor', cost_points: 250, sponsor_name: 'Demo partner', stock: 30 },
  { title: 'Lunch voucher', kind: 'sponsor', cost_points: 400, sponsor_name: 'Demo partner', stock: 20 },
  { title: 'Unlock Leader-level rounds', kind: 'skill_upgrade', cost_points: 200, sponsor_name: null, stock: 999 },
  { title: 'Skill certificate: AI-ready, Gear 2', kind: 'skill_upgrade', cost_points: 500, sponsor_name: null, stock: 999 },
  { title: 'Half-day learning leave', kind: 'company', cost_points: 600, sponsor_name: null, stock: 10 },
]

export const POLICY_TITLE = 'AI Usage Policy 2026'
export const POLICY_FILENAME = 'ai-usage-policy-2026.pdf'

// A short company document. The seeded pack's quotes come from it word for word.
export const POLICY_TEXT = `Northwind Labs AI Usage Policy 2026

1. Purpose
This policy explains how employees may use generative AI tools at work. AI can speed up drafting, coding and analysis, but every output remains the responsibility of the employee who uses it.

2. Approved tools
Only tools listed on the internal AI register may be used with company data. Personal accounts on public AI tools must never be used for client or employee information.

3. Data handling
Never paste customer personal data, credentials or unreleased financial results into an AI tool. If a task needs personal data, remove names and identifiers first or ask the data protection officer.

4. Reviewing AI output
Treat AI output as a first draft. Check every fact, figure and citation against a trusted source before sharing it. AI-written code must pass the same code review and tests as any other change, and new dependencies suggested by AI must be vetted by the security team.

5. Transparency
Tell your manager and, where relevant, the client when a deliverable was substantially produced with AI. Do not present AI output as your own independent research.

6. Incidents
If you think confidential data was shared with an unapproved tool, report it to security within 24 hours. Early reports are treated as a learning opportunity, not a disciplinary matter.
`

export interface SeedQuestion {
  type: QuestionType
  scenario: string
  question: string
  options: [string, string, string]
  best: 0 | 1 | 2
  second_best: 0 | 1 | 2 | null
  why: string
  source_quote: string
  source_location: string
  open_question: string | null
  source_url?: string
}

export const POLICY_QUESTIONS: SeedQuestion[] = [
  {
    type: 'decide',
    scenario: 'A client emails a spreadsheet of customer complaints with names and phone numbers. You want an AI tool to group the complaints by theme before tomorrow’s call.',
    question: 'What do you do first?',
    options: [
      'Paste the spreadsheet into the AI tool, it is only for internal use',
      'Remove names and phone numbers, then use an approved tool on the register',
      'Skip AI and read all 400 complaints by hand tonight',
    ],
    best: 1,
    second_best: 2,
    why: 'The policy allows AI once personal identifiers are removed and the tool is approved.',
    source_quote: 'If a task needs personal data, remove names and identifiers first or ask the data protection officer.',
    source_location: '§3 Data handling',
    open_question: null,
  },
  {
    type: 'ai_move',
    scenario: 'An AI assistant wrote a fix for a payments bug and added a new open-source package. Tests pass and the release is in two hours.',
    question: 'What has to happen before this merges?',
    options: [
      'Merge it, passing tests are enough',
      'Normal code review, plus the security team vets the new package',
      'Reject the fix because AI wrote it',
    ],
    best: 1,
    second_best: 0,
    why: 'AI code gets the same review as any change, and new AI-suggested dependencies need a security check.',
    source_quote: 'new dependencies suggested by AI must be vetted by the security team',
    source_location: '§4 Reviewing AI output',
    open_question: 'In one line: what would you check in the AI’s change before approving it?',
  },
  {
    type: 'decide',
    scenario: 'You realise you pasted a draft contract with a client’s pricing into a free public chatbot last week.',
    question: 'What is the right move now?',
    options: [
      'Report it to security today, it is within the 24-hour spirit of the policy',
      'Delete the chat history and say nothing',
      'Wait to see if anything leaks before telling anyone',
    ],
    best: 0,
    second_best: null,
    why: 'Early reporting is expected and is treated as learning, not discipline.',
    source_quote: 'report it to security within 24 hours',
    source_location: '§6 Incidents',
    open_question: null,
  },
  {
    type: 'ai_move',
    scenario: 'Your market report for a client was mostly drafted by AI, then edited by you. The client asks how it was put together.',
    question: 'How do you answer?',
    options: [
      'Say it is your own independent research',
      'Explain that AI produced the first draft and you checked and edited it',
      'Avoid the question and change the subject',
    ],
    best: 1,
    second_best: null,
    why: 'The policy asks you to be open when a deliverable was substantially produced with AI.',
    source_quote: 'Do not present AI output as your own independent research.',
    source_location: '§5 Transparency',
    open_question: 'In one line: how would you tell the client which parts AI did?',
  },
  {
    type: 'decide',
    scenario: 'An AI summary for leadership says churn fell 12% last quarter. The number looks good and the meeting starts in ten minutes.',
    question: 'What do you do with the figure?',
    options: [
      'Check it against the finance dashboard before it goes on the slide',
      'Use it, the AI read the same data',
      'Round it to 10% to be safe',
    ],
    best: 0,
    second_best: 2,
    why: 'Every figure from AI is a first draft until checked against a trusted source.',
    source_quote: 'Check every fact, figure and citation against a trusted source before sharing it.',
    source_location: '§4 Reviewing AI output',
    open_question: null,
  },
  {
    type: 'ai_move',
    scenario: 'A teammate wants to use their personal AI account to summarise employee survey comments because it is faster than the approved tool.',
    question: 'What do you tell them?',
    options: [
      'Fine, as long as they delete it afterwards',
      'Use the approved tool on the register; personal accounts can’t touch employee information',
      'Ban AI for anything related to the survey',
    ],
    best: 1,
    second_best: 2,
    why: 'Personal accounts on public tools are never allowed for employee information.',
    source_quote: 'Personal accounts on public AI tools must never be used for client or employee information.',
    source_location: '§2 Approved tools',
    open_question: null,
  },
]

// Today's news rounds per profession (from the prototype's sample content).
export const NEWS_QUESTIONS: Record<string, SeedQuestion[]> = {
  sde: [
    {
      type: 'decide',
      scenario: 'A worm called ChainDrop has compromised more than 400 npm packages. It runs during install and steals publishing tokens. Your last build pulled one.',
      question: 'What do you do first?',
      options: ['Delete node_modules and reinstall the latest versions', 'Keep working and mention it at tomorrow’s stand-up', 'Tell your lead now, pause builds, check the lockfile so secrets get rotated'],
      best: 2,
      second_best: 0,
      why: 'The damage is the stolen tokens. Reinstalling fixes neither.',
      source_quote: 'more than 400 packages across multiple unrelated publishers',
      source_location: 'Microsoft Security Blog, 4 Aug 2026',
      source_url: 'https://www.microsoft.com/en-us/security/blog/2026/08/04/chaindrop-supply-chain-compromise-anatomy-self-propagating-worm/',
      open_question: null,
    },
    {
      type: 'ai_move',
      scenario: 'An AI coding agent fixed your bug by changing nine files and adding one new package. Tests pass. 68% of developers now use coding agents daily.',
      question: 'What do you do before merging?',
      options: ['Read every changed line, question each file, vet the new package', 'Merge, since the tests pass', 'Reject it and rewrite the fix by hand'],
      best: 0,
      second_best: 2,
      why: 'Passing tests prove the fix, not the extra changes or the new dependency.',
      source_quote: '68% use them daily',
      source_location: 'JetBrains, 19 Aug 2026',
      source_url: 'https://blog.jetbrains.com/research/2026/08/ai-coding-agent-adoption-2026/',
      open_question: 'In one line: what would you check before trusting the agent’s change?',
    },
  ],
  data: [
    {
      type: 'decide',
      scenario: 'Bengaluru raised $4.4 billion in Jan–Sep 2026, 43% of India’s tech funding, but across fewer deals. A partner wants the slide titled “Startup activity is booming”.',
      question: 'What goes on the slide?',
      options: ['The title as asked, since the total is up', 'Value and deal count side by side: “More money, fewer deals”', 'Deal count only, since it is the more honest number'],
      best: 1,
      second_best: 2,
      why: 'Value and count moved in opposite directions. Either one alone misleads.',
      source_quote: 'Bengaluru draws $4.4B despite fewer deals',
      source_location: 'NewsBytes, 25 Sept 2026',
      source_url: 'https://www.newsbytesapp.com/news/business/bengaluru-draws-44b-despite-fewer-deals-as-funding-reaches-103b/tldr',
      open_question: null,
    },
    {
      type: 'ai_move',
      scenario: 'Your team uses AI to write SQL and summarise the weekly dashboard. Indian professionals rank checking AI output as the top skill: 63%, against 50% globally.',
      question: 'Where does the human checkpoint go?',
      options: ['AI writes query and summary; send straight to stakeholders', 'Test the query against a trusted figure, check joins, sign off every number', 'Stop using AI for anything that touches numbers'],
      best: 1,
      second_best: 2,
      why: 'A query can run cleanly and still double-count through a bad join.',
      source_quote: 'quality control of AI output highest of any market at 63%',
      source_location: 'Microsoft Work Trend Index 2026, India',
      source_url: 'https://news.microsoft.com/source/asia/2026/09/03/indias-ai-advantage-is-human-microsoft-work-trend-index-2026-finds-india-among-the-worlds-leading-frontier-workforces/',
      open_question: 'In one line: how would you check an AI-written query before sharing its numbers?',
    },
  ],
  mkt: [
    {
      type: 'decide',
      scenario: 'A third of your leads come from WhatsApp and email campaigns to a database with no consent records. India’s data protection obligations start on 13 May 2027.',
      question: 'What do you fund this quarter?',
      options: ['A consent programme: re-permission, consent logged per purpose, one owner', 'Keep sending until the deadline, then fix it', 'Stop all campaigns and move the budget to paid ads'],
      best: 0,
      second_best: 2,
      why: 'It keeps the channel working past the deadline.',
      source_quote: 'The substantive obligations commence May 13, 2027',
      source_location: 'ProtectComply, 21 Sept 2026',
      source_url: 'https://protectcomply.com/blog/dpdp-consent-whatsapp-sms-email-marketing/',
      open_question: null,
    },
    {
      type: 'ai_move',
      scenario: 'Your team of eight uses AI for copy, ad variants and reports. 86% of Indian employees use AI at work, but only 49% of organisations have a formal AI policy.',
      question: 'What do you set up first?',
      options: ['Let everyone use any tool however they like', 'Ban AI from all client-facing work', 'A one-page standard: what AI may draft, a named reviewer, no personal data'],
      best: 2,
      second_best: 1,
      why: 'Rules plus a reviewer keep the speed without the risk.',
      source_quote: '49% of Indian organizations now have a formal AI policy',
      source_location: 'ISACA via NewKerala, May 2026',
      source_url: 'https://www.newkerala.com/news/a/86-pc-indian-employees-use-ai-roi-governance-633.htm',
      open_question: 'In one line: what is one rule you would put in that standard?',
    },
  ],
}

// Professions without their own news set fall back to a general one.
export const GENERAL_NEWS: SeedQuestion[] = [
  {
    type: 'ai_move',
    scenario: 'Your manager asks everyone to try AI for one weekly task. 86% of Indian employees already use AI at work, but only 35% say its return met expectations.',
    question: 'Which task do you pick first?',
    options: ['A repeatable task with a clear right answer you can check', 'Your most important client decision', 'Whatever the AI suggests it is good at'],
    best: 0,
    second_best: 2,
    why: 'Start where you can measure and check the output, then widen.',
    source_quote: '86 pc Indian employees use AI',
    source_location: 'ISACA via NewKerala, May 2026',
    source_url: 'https://www.newkerala.com/news/a/86-pc-indian-employees-use-ai-roi-governance-633.htm',
    open_question: 'In one line: how would you check what the AI gives back?',
  },
  {
    type: 'decide',
    scenario: 'Bengaluru commuters lose about 168 hours a year to rush-hour traffic. Your team wants to move the weekly sync to 9 a.m. so it is “done early”.',
    question: 'What do you propose?',
    options: ['Keep 9 a.m. for everyone', 'Move it to late morning and keep it short, with notes for anyone on the road', 'Cancel the sync entirely'],
    best: 1,
    second_best: 0,
    why: 'It respects commute time without losing the team’s rhythm.',
    source_quote: '168 hours',
    source_location: 'TomTom Traffic Index 2025',
    source_url: 'https://www.tomtom.com/traffic-index/',
    open_question: null,
  },
]
