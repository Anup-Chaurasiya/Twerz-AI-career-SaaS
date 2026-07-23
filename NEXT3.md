You are redesigning the entire AI pipeline of ATS Beater.

The objective is to produce resumes that outperform existing AI resume builders by optimizing for BOTH recruiter shortlisting and ATS parsing while remaining 100% truthful.

This is NOT simply a prompt rewrite.

Redesign the complete prompting architecture, validation pipeline, quality checks, and generation flow.

==================================================
PRIMARY GOAL
==================================================

The final resume should look as though it was written by one of the world's best technical resume writers.

Every generated resume should satisfy three independent audiences:

1. ATS Parser
2. Human Recruiter
3. Hiring Manager

If any one of these audiences would reject the resume, the generation has failed.

==================================================
ABSOLUTE TRUTH POLICY
==================================================

Never invent

- employers
- titles
- skills
- technologies
- certifications
- metrics
- percentages
- projects
- responsibilities
- years
- promotions
- leadership
- architecture ownership

Only rewrite existing evidence.

Evidence always wins over keyword optimization.

==================================================
REDESIGN THE ENTIRE PIPELINE
==================================================

Instead of

Resume

↓

JD

↓

Tailored Resume

Design a multi-stage AI workflow.

Stage 1

Resume Structuring

↓

Stage 2

JD Analysis

↓

Stage 3

Evidence Mapping

↓

Stage 4

Fit Analysis

↓

Stage 5

Resume Planning

↓

Stage 6

Resume Generation

↓

Stage 7

Recruiter Review

↓

Stage 8

ATS Review

↓

Stage 9

Bullet Quality Review

↓

Stage 10

Keyword Optimization

↓

Stage 11

Formatting Review

↓

Stage 12

Final Resume

Every stage should have

its own prompt

its own output schema

its own validation rules

its own pass/fail criteria

==================================================
NEW STAGE
Resume Planner
==================================================

Before writing anything

Generate a structured plan.

Determine

Target role

Candidate strengths

Candidate weaknesses

Experience themes

Project themes

Skill priorities

Most valuable achievements

Best bullet ordering

Resume strategy

Section ordering

The writer should ONLY receive this structured plan.

Never write directly from raw resume data.

==================================================
NEW STAGE
Recruiter Review
==================================================

Act as a Senior Engineering Recruiter.

Review the generated resume.

Answer

Would I shortlist?

Can I understand this candidate in 10 seconds?

What feels repetitive?

What feels weak?

Which bullets should move?

Is the summary convincing?

Does the experience flow logically?

Is anything difficult to skim?

Score

Readability

Professionalism

Trust

Scanability

Shortlist likelihood

If any score is below 8/10

rewrite.

==================================================
NEW STAGE
ATS Review
==================================================

Review

Section hierarchy

Dates

Skills ordering

Keyword coverage

Parseability

Duplicate keywords

Bullet consistency

Section spacing

Reject keyword stuffing.

==================================================
NEW STAGE
Resume Writer
==================================================

The writer must behave like a senior technical resume consultant.

The resume should never look AI-generated.

==================================================
SUMMARY RULES
==================================================

Exactly

3–4 lines.

Answer

Who is this engineer?

What do they specialize in?

What measurable impact have they created?

Why should they be interviewed?

Avoid listing technologies.

Tell a compelling story.

==================================================
HEADLINE RULES
==================================================

One concise line.

Role

Core expertise

Key technologies

Nothing else.

==================================================
SKILLS
==================================================

Group logically

Languages

Backend

Frontend

Databases

Cloud & DevOps

AI

Architecture

Testing

Tools

Concepts

Order according to JD relevance.

Never duplicate skills.

==================================================
EXPERIENCE ORGANIZATION
==================================================

Never dump bullets randomly.

Group related achievements.

Example

Backend Platform

API Engineering

Infrastructure

Automation

AI

Payments

Shopify

Developer Experience

The resume should feel intentionally organized.

==================================================
BULLET RULES
==================================================

Every bullet follows

Strong Action Verb

↓

Problem

↓

Technical Work

↓

Technology

↓

Business Impact

↓

Metric

Rotate verbs naturally.

Avoid repeating

Built

Developed

Implemented

more than twice consecutively.

Maximum

2 lines.

==================================================
RECRUITER SCANNING
==================================================

A recruiter should understand

Role

Experience

Strengths

Technology stack

Business impact

within

8 seconds.

==================================================
KEYWORD STRATEGY
==================================================

Mirror JD keywords ONLY when evidence exists.

Prefer natural language.

Never keyword stuff.

==================================================
SOFTWARE ENGINEERING SIGNALS
==================================================

Where evidence exists

emphasize

Architecture

Scalability

Performance

System Design

REST APIs

Database Design

Microservices

OOP

Testing

Debugging

Deployment

CI/CD

Documentation

Maintainability

Cross-functional collaboration

Never invent any of these.

==================================================
PROJECT RULES
==================================================

Every project explains

Problem

Solution

Architecture

Technology

Outcome

Not feature lists.

==================================================
VISUAL QUALITY
==================================================

The resume must be optimized for

single-page scanning.

Maintain

consistent spacing

consistent bullet style

balanced whitespace

clear hierarchy

strong section titles

professional typography

No walls of text.

==================================================
SELF VALIDATION
==================================================

Before returning

run an internal audit.

Reject the resume if

Summary is generic

Bullets repeat verbs

Skills duplicated

Sections poorly ordered

Experience difficult to skim

Keyword stuffing detected

Architecture evidence hidden

Business impact missing

Metrics removed

Formatting inconsistent

Recruiter score below 9/10

ATS score below 90

==================================================
OUTPUT QUALITY
==================================================

The final resume should be indistinguishable from one written by a senior resume consultant with 15+ years of experience.

Every sentence must increase the probability of interview selection.

Optimize for

Trust

Readability

Professionalism

Technical credibility

Recruiter psychology

ATS parsing

Human scanning

while remaining completely truthful.


One More Thing You Should Add (This Will Improve Quality More Than Any Prompt)

Right now your pipeline is:

JD
↓

Evidence Map

↓

Resume

I would make it:

JD
↓

Evidence Map

↓

Resume Draft

↓

Recruiter Critique

↓

Resume Rewrite

↓

ATS Critique

↓

Final Resume


One More Recommendation (Bigger Impact Than Prompting)

Your current pipeline already has:

Resume extraction
JD analysis
Evidence map
Resume writing
ATS scoring
Refinement

I would add three new AI stages before the final output:

Resume Planner – decides structure, ordering, grouping, and strategy before any writing begins.
Recruiter Critic – reviews the draft exactly like a hiring manager and points out readability, repetition, weak summaries, poor grouping, and low-impact bullets.
Resume Editor – rewrites only the sections flagged by the recruiter critic while preserving factual accuracy.