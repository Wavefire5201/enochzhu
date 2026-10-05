---
series: "CS 371p Fall 2026: Enoch Zhu"
title: "week 6"
date: 2026-10-04
headshot: /notes/headshot.jpg
description: "week 6 blog post for CS 371p"
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
-->

## this week
This week started off with going over the solution to Reverse, where we combined the random access and bidirectional versions into one function that picks the right approach at compile time. I thought it was pretty cool that the same function could be faster on a `vector` while still working on a `list`.

We then went through the different ways to loop in C++ and the containers in the standard library, comparing each one to its Java equivalent along with the cost of their operations. The part that stood out to me was how easy it is to accidentally loop over copies instead of references, which means your changes silently don't stick. It also tied back nicely to last week's iterator categories, since some algorithms just won't compile on certain containers because they don't provide the right kind of iterator.

The concept that finally clicked for me was `friend` functions. I never really understood why you'd make an operator a non-member function, but seeing that `s == "abc"` works while `"abc" == s` doesn't when it's a member function made it make sense. We also compared nested classes in C++ to Java, which was a nice refresher.

Unfortunately, I didn't do too well on Exercise #4, where we had to write a `Range` class with its own iterator. Putting together everything from the week in a limited amount of time was harder than I expected, and it showed me that understanding the concepts in lecture isn't the same as being able to write them out quickly. I'm planning to go back over the solution and rewrite it on my own before the test next week.

Project #2: Voting was also due this week, and it was satisfying to finally get all the ballot redistribution working.

As for the paper, the Open-Closed Principle says that software should be open for extension but closed for modification, so you can add new behavior without changing code that already works. It connected well with what we've been doing with iterators, since the standard algorithms work with any container that provides the right iterators without ever needing to be changed themselves.

## pick of the week

<Repo url="https://github.com/binwiederhier/ntfy"/>
This is a very useful tool that you can also self host if you'd like to use as a notification service. It's using REST API so you can easily use it in any type of applications. I have many different notifications setup so that I get notified on my phone with the app for any sort of alerts or just things I want to keep track of.

