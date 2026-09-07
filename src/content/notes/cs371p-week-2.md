---
series: "CS 371p Fall 2026: Enoch Zhu"
title: "week 2"
date: 2026-09-06
headshot: /notes/headshot.jpg
description: "week 2 blog post for CS 371p"
draft: false
---

<script>
  import Repo from "$lib/components/Repo.svelte";
</script>

<!--
Which concept from this week surprised you, challenged you, or finally “clicked”?

How did the collaborative quizzes help you understand the material - or show you what you still need to work on?

Did the programming challenge change how you think about solving problems under pressure?

What perspective did the assigned paper give you on real-world software engineering?

Was there a moment of discovery, frustration, or teamwork this week that stands out?

This blog is for you — a way to connect the dots, reflect on how you learn, and see your growth over time. It’s not graded, but many students find it to be an excellent record to look back on for interviews, portfolios, or simply for personal insight into their journey as software engineers.
-->

## this week
Some topics that stood out to me this week was the formal introduction of l-values and r-values, and also that certain expressions worked in C++ but not in C or Java. I also did not know that there were precendences in terms of the pre and post operators, which will definitely be useful in the future when programming.

The collaborative quizzes this week were still helpful this week, although I would say the most helpful part is to review the notes before taking the quiz. Many of the main points in the comments are usually on the quizzes which helped refresh my memory.

The programming challenge this week was interesting because I had to take a different approach to solve the problem after my initial approach took too long on the time limit. I did have to look up ways to optimize the time complexity, but I can see that we're still using vectors from the previous, broken problem but in a much simpler way in this one.

On the assigned paper which discussed an agentic development methodology called the Elephant-Goldfish Model (EGM), I feel that I've already been taking a similar approach for a while when bootstrapping new projects from scratch. Create and refine a plan, have another agent review it, then use many subagents to execute. The main problem arises when you're after the initial starting-from-scratch phase, where you start having to create many smaller changes. Do you just tell the elephant what you want to change, and delegate to a goldfish, or do you restart the process all over again? Probably the former, seeing as the whole point was to have persistent context so we don't waste time and tokens on unnecessary tangents.

I think one moment of frustration was running out of time on the Ed Lesson. I was almost able to submit the final working solution after discussing with my friend, but Professor Downing continued early when there was still five minutes remaining. Although I know it will be dropped, I hope I can improve for the next time and work quicker.

## pick of the week

<Repo url="https://github.com/ByteDance-Seed/Depth-Anything-3"/>
If you check out my website main page on the desktop, you'd be able to see a parallax effect when you hover over the image. This is achived using the Depth Anything 3 model from ByteDance, by creating a depth projection image from an input image. Check it out and mess around to see what you can create with it!
